document.addEventListener('DOMContentLoaded', function() {
    const startRecordingBtn = document.getElementById('start-recording');
    const recordingControls = document.getElementById('recording-controls');
    const pauseResumeBtn = document.getElementById('pause-resume');
    const stopRecordingBtn = document.getElementById('stop-recording');
    const audioPlayer = document.getElementById('audio-player');
    const playPauseBtn = document.getElementById('play-pause');
    const audioProgress = document.getElementById('audio-progress');
    const currentTimeSpan = document.getElementById('current-time');
    const durationSpan = document.getElementById('duration');
    const deleteRecordingBtn = document.getElementById('delete-recording');
    const deleteRecordingContainer = document.getElementById('delete-recording-container');
    const selectedDeviceSpan = document.getElementById('selected-device');
    const testMicBtn = document.getElementById('test-mic');
    const changeMicBtn = document.getElementById('change-mic');
    const streamToggle = document.getElementById('stream-toggle');
    const transcript = document.getElementById('transcript');
    const templateSelect = document.getElementById('template-select');
    const additionalInstructions = document.getElementById('additional-instructions');
    const generateButton = document.getElementById('generate-button');
    const analysisResults = document.getElementById('analysis-results');
    const micTestModal = document.getElementById('mic-test-modal');
    const micChangeModal = document.getElementById('mic-change-modal');
    const startTestBtn = document.getElementById('start-test');
    const audioLevelDiv = document.getElementById('audio-level');
    const deviceListDiv = document.getElementById('device-list');
    const testStatusDiv = document.getElementById('test-status');
    const playbackControlsDiv = document.getElementById('playback-controls');
    const playRecordingBtn = document.getElementById('play-recording');
    const timerBar = document.querySelector('.timer-bar');
    const timerText = document.querySelector('.timer-text');
    const flagSelector = document.getElementById('flag-selector');
    const audioVisualizer = document.getElementById('audio-visualizer');
    const flagButton = document.getElementById('flag-button');
    const flagMenu = document.getElementById('flag-menu');
    const volumeBtn = document.getElementById('volume-btn');
    const volumeSlider = document.getElementById('volume-slider');
  
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob;
    let audioUrl;
    let audio = new Audio();
    let isRecording = false;
    let isPaused = false;
    let recordingStartTime;
    let recordingDuration = 0;
    let recordingInterval;
    let visualizerInterval;
    let selectedDevice = null;
    let testAudioBlob = null;
    let testAudio = new Audio();
    let audioContext;
    let analyser;
    let pauseStartTime;
    let totalPauseDuration = 0;
  
    async function getDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            if (audioDevices.length > 0 && !selectedDevice) {
                selectedDevice = audioDevices[0];
                selectedDeviceSpan.textContent = selectedDevice.label;
            }
            updateDeviceList(audioDevices);
        } catch (error) {
            console.error('Error getting devices:', error);
        }
    }
  
    function updateDeviceList(devices) {
        deviceListDiv.innerHTML = '';
        devices.forEach(device => {
            const button = document.createElement('button');
            button.textContent = device.label;
            button.onclick = () => {
                selectedDevice = device;
                selectedDeviceSpan.textContent = device.label;
                micChangeModal.style.display = 'none';
            };
            deviceListDiv.appendChild(button);
        });
    }
  
    startRecordingBtn.addEventListener('click', startRecording);
    pauseResumeBtn.addEventListener('click', pauseResumeRecording);
    stopRecordingBtn.addEventListener('click', stopRecording);
    playPauseBtn.addEventListener('click', togglePlayPause);
    audioProgress.addEventListener('input', seekAudio);
    deleteRecordingBtn.addEventListener('click', deleteRecording);
    testMicBtn.addEventListener('click', openMicTestModal);
    changeMicBtn.addEventListener('click', openMicChangeModal);
    startTestBtn.addEventListener('click', startMicTest);
    playRecordingBtn.addEventListener('click', playTestRecording);
    flagButton.addEventListener('click', toggleFlagMenu);
    document.addEventListener('click', closeFlagMenu);
    volumeBtn.addEventListener('click', toggleVolumeSlider);
    volumeSlider.addEventListener('input', changeVolume);
  
    templateSelect.addEventListener('change', () => {
        if (templateSelect.value) {
            additionalInstructions.style.display = 'flex';
            generateButton.disabled = false;
        } else {
            additionalInstructions.style.display = 'none';
            generateButton.disabled = true;
        }
        analysisResults.style.display = 'none';
    });
  
    generateButton.addEventListener('click', () => {
        analysisResults.style.display = 'block';
        setupCopyButtons();
        setupAdjustButtons();
    });
  
    audio.addEventListener('timeupdate', updateAudioProgress);
    audio.addEventListener('loadedmetadata', () => {
        durationSpan.textContent = formatTime(audio.duration);
        currentTimeSpan.textContent = '0:00';
    });
  
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: selectedDevice ? { exact: selectedDevice.deviceId } : undefined }
            });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                audioUrl = URL.createObjectURL(audioBlob);
                audio.src = audioUrl;
                showAudioPlayer();
            };
  
            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            isPaused = false;
            recordingStartTime = Date.now();
            totalPauseDuration = 0;
            updateRecordingTime();
            recordingInterval = setInterval(updateRecordingTime, 1000);
  
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            updateVisualizer();
  
            startRecordingBtn.style.display = 'none';
            flagSelector.style.display = 'none';
            recordingControls.style.display = 'block';
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Unable to access the microphone. Please ensure you have granted the necessary permissions.');
        }
    }
  
    function pauseResumeRecording() {
        if (isPaused) {
            mediaRecorder.resume();
            isPaused = false;
            totalPauseDuration += Date.now() - pauseStartTime;
            pauseResumeBtn.textContent = 'Pause';
            updateVisualizer();
        } else {
            mediaRecorder.pause();
            isPaused = true;
            pauseStartTime = Date.now();
            clearInterval(recordingInterval);
            pauseResumeBtn.textContent = 'Resume';
        }
        updateRecordingTime();
        if (!isPaused) {
            recordingInterval = setInterval(updateRecordingTime, 1000);
        }
    }
  
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            isRecording = false;
            isPaused = false;
            clearInterval(recordingInterval);
        }
    }
  
    function updateRecordingTime() {
        if (isRecording) {
            const currentTime = Date.now();
            if (isPaused) {
                recordingDuration = pauseStartTime - recordingStartTime - totalPauseDuration;
            } else {
                recordingDuration = currentTime - recordingStartTime - totalPauseDuration;
            }
            document.getElementById('recording-time').textContent = formatTime(recordingDuration / 1000);
        }
    }
  
    function updateVisualizer() {
        if (!isRecording || isPaused) return;
  
        const canvas = audioVisualizer;
        const canvasCtx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
  
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
  
        canvasCtx.clearRect(0, 0, width, height);
  
        function draw() {
            if (!isRecording || isPaused) return;
  
            requestAnimationFrame(draw);
  
            analyser.getByteTimeDomainData(dataArray);
  
            canvasCtx.fillStyle = 'rgb(240, 240, 240)';
            canvasCtx.fillRect(0, 0, width, height);
  
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
            canvasCtx.beginPath();
  
            const sliceWidth = width * 1.0 / bufferLength;
            let x = 0;
  
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * height / 2;
  
                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
  
                x += sliceWidth;
            }
  
            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke();
        }
  
        draw();
    }
  
    function showAudioPlayer() {
        recordingControls.style.display = 'none';
        audioPlayer.style.display = 'block';
        deleteRecordingBtn.style.display = 'block';
        durationSpan.textContent = formatTime(audio.duration);
        updateVolumeIcon();
        volumeSlider.value = audio.volume;
        volumeSlider.style.display = 'none';
        volumeBtn.classList.remove('active');
    }
  
    function togglePlayPause() {
      if (audio.paused) {
        audio.play();
        playPauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
      } else {
        audio.pause();
        playPauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      }
      updateAudioProgress();
      updateVolumeIcon();
    }
  
    function updateAudioProgress() {
      const progress = (audio.currentTime / audio.duration) * 100;
      audioProgress.value = progress;
      currentTimeSpan.textContent = formatTime(audio.currentTime);
    }
  
    function seekAudio() {
        const seekTime = (audioProgress.value / 100) * audio.duration;
        audio.currentTime = seekTime;
    }
  
    function deleteRecording() {
        audio.pause();
        audioPlayer.style.display = 'none';
        deleteRecordingBtn.style.display = 'none';
        startRecordingBtn.style.display = 'inline-flex';
        flagSelector.style.display = 'block';
        audioChunks = [];
        audioBlob = null;
        audioUrl = null;
        audio.src = '';
    }
  
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  
    function openMicTestModal() {
        micTestModal.style.display = 'block';
        document.getElementById('testing-device').textContent = `Testing: ${selectedDevice ? selectedDevice.label : 'Default Microphone'}`;
    }
  
    function openMicChangeModal() {
        micChangeModal.style.display = 'block';
        getDevices();
    }
  
    async function startMicTest() {
        if (testAudioBlob) {
            testAudioBlob = null;
            testAudio.src = '';
            playbackControlsDiv.style.display = 'none';
        }
  
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: selectedDevice ? { exact: selectedDevice.deviceId } : undefined }
            });
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];
  
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
  
            mediaRecorder.onstop = () => {
                testAudioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                testAudio.src = URL.createObjectURL(testAudioBlob);
                playbackControlsDiv.style.display = 'block';
            };
  
            let testDuration = 0;
            const testInterval = setInterval(() => {
                testDuration += 0.1;
                const progress = (testDuration / 5) * 100;
                timerBar.style.width = `${progress}%`;
                timerText.textContent = `${testDuration.toFixed(1)}s`;
  
                if (testDuration >= 5) {
                    clearInterval(testInterval);
                    mediaRecorder.stop();
                    stream.getTracks().forEach(track => track.stop());
                    startTestBtn.disabled = false;
                    startTestBtn.textContent = 'Start Test';
                    testStatusDiv.textContent = 'Test complete. You can now play back the recording.';
                }
            }, 100);
  
            mediaRecorder.start();
            startTestBtn.disabled = true;
            startTestBtn.textContent = 'Testing...';
            testStatusDiv.textContent = 'Recording in progress...';
  
            // Audio level visualization
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
  
            function updateAudioLevel() {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
                const level = (average / 255) * 100;
                audioLevelDiv.querySelector('.audio-level-bar').style.width = `${level}%`;
  
                if (testDuration < 5) {
                    requestAnimationFrame(updateAudioLevel);
                }
            }
  
            updateAudioLevel();
        } catch (error) {
            console.error('Error starting microphone test:', error);
            testStatusDiv.textContent = 'Error: Unable to access microphone';
            startTestBtn.disabled = false;
        }
    }
  
    function playTestRecording() {
        if (testAudio.paused) {
            testAudio.play();
            playRecordingBtn.textContent = 'Pause';
        } else {
            testAudio.pause();
            playRecordingBtn.textContent = 'Play Recording';
        }
    }
  
    window.onclick = (event) => {
        if (event.target === micTestModal) {
            micTestModal.style.display = 'none';
        }
        if (event.target === micChangeModal) {
            micChangeModal.style.display = 'none';
        }
    };
  
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    getDevices();
  
    function toggleFlagMenu(event) {
      event.stopPropagation();
      const isExpanded = flagButton.getAttribute('aria-expanded') === 'true';
      flagButton.setAttribute('aria-expanded', !isExpanded);
      flagMenu.style.display = isExpanded ? 'none' : 'block';
    }
  
    function closeFlagMenu(event) {
      if (!flagSelector.contains(event.target)) {
        flagButton.setAttribute('aria-expanded', 'false');
        flagMenu.style.display = 'none';
      }
    }
  
    function selectFlag(countryCode, languageName) {
      const imgSrc = `https://flagcdn.com/w20/${countryCode}.png`;
      const imgSrcset = `https://flagcdn.com/w40/${countryCode}.png 2x`;
      flagButton.innerHTML = `<img src="${imgSrc}" srcset="${imgSrcset}" width="20" alt="${languageName}">`;
      flagButton.setAttribute('aria-expanded', 'false');
      flagMenu.style.display = 'none';
    }
  
    flagMenu.querySelectorAll('li').forEach(item => {
      item.addEventListener('click', () => {
        const countryCode = item.dataset.countryCode;
        const languageName = item.textContent.trim();
        selectFlag(countryCode, languageName);
      });
    });
  
    function toggleVolumeSlider() {
      if (volumeSlider.style.display === 'none') {
        volumeSlider.style.display = 'block';
        volumeBtn.classList.add('active');
      } else {
        volumeSlider.style.display = 'none';
        volumeBtn.classList.remove('active');
      }
    }
  
    function changeVolume() {
      audio.volume = volumeSlider.value;
      updateVolumeIcon();
    }
  
    function updateVolumeIcon() {
      const volume = audio.volume;
      if (volume === 0) {
        volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
      } else if (volume < 0.5) {
        volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
      } else {
        volumeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
      }
    }
  
    function setupCopyButtons() {
      const copyButtons = document.querySelectorAll('.copy-button');
      copyButtons.forEach(button => {
          button.addEventListener('click', async () => {
              const targetId = button.getAttribute('data-target');
              const content = document.getElementById(targetId).value;
              try {
                  await navigator.clipboard.writeText(content);
                  // Optional: Show feedback
                  const icon = button.querySelector('svg');
                  const originalColor = icon.style.color;
                  icon.style.color = '#4CAF50';
                  setTimeout(() => {
                      icon.style.color = originalColor;
                  }, 1000);
              } catch (err) {
                  console.error('Failed to copy: ', err);
              }
          });
      });
    }
  
    function setupAdjustButtons() {
      const adjustButtons = document.querySelectorAll('.adjust-button');
      const adjustReportContent = document.getElementById('adjust-report-content');
      
      adjustButtons.forEach(button => {
          button.addEventListener('click', () => {
              adjustReportContent.value = button.textContent;
              adjustReportContent.focus();
          });
      });
    }
  
  });

