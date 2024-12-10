// document.addEventListener('DOMContentLoaded', () => {
//     const channelSelector = document.getElementById('channelSelector');
//     const videoPlayer = document.getElementById('videoPlayer');
//     const muteToggle = document.getElementById('muteToggle');
//     const mp3VolumeControl = document.getElementById('mp3VolumeControl');
//     const mp3MuteToggle = document.getElementById('mp3MuteToggle');
//     const descriptionContainer = document.getElementById('descriptionContainer');
//     const notificationIcon = document.getElementById('notificationIcon');
//     const notificationModal = document.getElementById('notificationModal');
//     const notificationList = document.getElementById('notificationList');
//     const closeModal = notificationModal.querySelector('.close');
//     const searchBar = document.getElementById('searchBar');

//     let audioContext;
//     let gainNode;
//     let audioElement;
//     let currentChannel;

//     async function loadBackupChannels() {
//         try {
//             const response = await fetch('/api/backup-channels');
//             const channels = await response.json();
//             populateChannelSelector(channels);
//         } catch (error) {
//             console.error('Error loading backup channels:', error);
//         }
//     }

//     function populateChannelSelector(channels) {
//         channelSelector.innerHTML = '<option value="">Select channel</option>';
//         channels.forEach(channel => {
//             const option = document.createElement('option');
//             option.value = channel.name;
//             option.textContent = channel.name;
//             channelSelector.appendChild(option);
//         });
//         channelSelector.addEventListener('change', handleChannelSelection);
//     }

//     function handleChannelSelection(event) {
//         const selectedChannel = event.target.value;
//         currentChannel = selectedChannel;
//         if (selectedChannel) {
//             fetch('/api/backup-channels')
//                 .then(response => response.json())
//                 .then(channels => {
//                     const channel = channels.find(c => c.name === selectedChannel);
//                     if (channel) {
//                         populateVideoSelector(channel.videos);
//                     }
//                 })
//                 .catch(error => console.error('Error fetching channel videos:', error));
//         }
//     }

//     function populateVideoSelector(videos) {
//         // Remove any existing video selector container
//         const existingVideoSelectorContainer = document.querySelector('.video-selector-container');
//         if (existingVideoSelectorContainer) {
//             existingVideoSelectorContainer.remove();
//         }

//         const videoSelectorContainer = document.createElement('div');
//         videoSelectorContainer.className = 'video-selector-container';
//         videoSelectorContainer.innerHTML = `
//             <select id="videoSelect" class="video-select">
//                 <option value="">Select video</option>
//             </select>
//         `;
//         const select = videoSelectorContainer.querySelector('#videoSelect');
//         videos.forEach(video => {
//             const option = document.createElement('option');
//             option.value = video.video;
//             option.textContent = video.video;
//             select.appendChild(option);
//         });
//         select.addEventListener('change', handleVideoSelection);

//         // Insert the video selector after the channel selector
//         channelSelector.parentNode.insertBefore(videoSelectorContainer, channelSelector.nextSibling);
//     }

//     function handleVideoSelection(event) {
//         const selectedVideo = event.target.value;
//         if (selectedVideo) {
//             const baseName = selectedVideo.split('.').slice(0, -1).join('.');
//             const videoPath = `/backup/${currentChannel}/original_videos/${selectedVideo}`;
//             const audioPath = `/backup/${currentChannel}/generated_audios/${baseName}.mp3`;
//             const captionsPath = `/backup/${currentChannel}/captions/${baseName}.vtt`;
//             loadVideo(videoPath, audioPath, captionsPath);
//         }
//     }

//     function loadVideo(videoPath, audioPath, captionsPath) {
//         videoPlayer.src = videoPath;
//         videoPlayer.load();
    
//         if (audioElement) {
//             audioElement.pause();
//             audioElement.remove();
//         }
    
//         audioElement = new Audio(audioPath);
//         audioElement.load();
    
//         videoPlayer.onplay = () => audioElement.play();
//         videoPlayer.onpause = () => audioElement.pause();
//         videoPlayer.onseeked = () => {
//             audioElement.currentTime = videoPlayer.currentTime;
//         };
    
//         if (!audioContext) {
//             audioContext = new (window.AudioContext || window.webkitAudioContext)();
//             gainNode = audioContext.createGain();
//             gainNode.connect(audioContext.destination);
//         }
    
//         const source = audioContext.createMediaElementSource(audioElement);
//         source.connect(gainNode);
    
//         // Remove existing caption tracks
//         while (videoPlayer.firstChild) {
//             videoPlayer.removeChild(videoPlayer.firstChild);
//         }
    
//         // Create and add the new caption track
//         const track = document.createElement('track');
//         track.kind = 'captions';
//         track.label = 'Arabic';
//         track.srclang = 'ar';
//         track.src = captionsPath;
//         track.default = true;
//         videoPlayer.appendChild(track);
    
//         // Load captions into the description container
//         fetch(captionsPath)
//             .then(response => response.text())
//             .then(captionsText => {
//                 descriptionContainer.innerHTML = parseVtt(captionsText);
//             })
//             .catch(error => console.error('Error loading captions:', error));
//     }
    
//     function parseVtt(vttText) {
//         const lines = vttText.split('\n');
//         let parsedHtml = '';
//         let isCaption = false;
    
//         for (let line of lines) {
//             if (line.includes('-->')) {
//                 isCaption = true;
//                 continue;
//             }
//             if (line.trim() === '' && isCaption) {
//                 isCaption = false;
//                 parsedHtml += '<br>';
//                 continue;
//             }
//             if (isCaption && line.trim() !== '') {
//                 parsedHtml += `<p>${line.trim()}</p>`;
//             }
//         }
    
//         return parsedHtml;
//     }

//     muteToggle.addEventListener('click', () => {
//         muteToggle.classList.toggle('active');
//         videoPlayer.muted = !videoPlayer.muted;
//     });

//     mp3MuteToggle.addEventListener('click', () => {
//         mp3MuteToggle.classList.toggle('active');
//         audioElement.muted = !audioElement.muted;
//     });

//     mp3VolumeControl.addEventListener('input', () => {
//         if (gainNode) {
//             gainNode.gain.setValueAtTime(mp3VolumeControl.value, audioContext.currentTime);
//         }
//     });

//     // Notification modal functionality
//     notificationIcon.addEventListener('click', (e) => {
//         e.preventDefault();
//         notificationModal.style.display = 'block';
//     });

//     closeModal.addEventListener('click', () => {
//         notificationModal.style.display = 'none';
//     });

//     window.addEventListener('click', (e) => {
//         if (e.target === notificationModal) {
//             notificationModal.style.display = 'none';
//         }
//     });

//     // Function to update notification count (you'll need to implement the logic to fetch actual notifications)
//     function updateNotificationCount() {
//         // Placeholder: Replace with actual notification count
//         const count = 0;
//         document.getElementById('notificationCount').textContent = count;
//     }

//     function handleSearch(event) {
//         const query = event.target.value.toLowerCase();
//         if (query) {
//             fetch('/api/backup-channels')
//                 .then(response => response.json())
//                 .then(channels => {
//                     const searchResults = [];
//                     channels.forEach(channel => {
//                         channel.videos.forEach(video => {
//                             if (video.video.toLowerCase().includes(query)) {
//                                 searchResults.push({
//                                     channel: channel.name,
//                                     video: video.video
//                                 });
//                             }
//                         });
//                     });
//                     displaySearchResults(searchResults);
//                 })
//                 .catch(error => console.error('Error fetching search results:', error));
//         } else {
//             clearSearchResults();
//         }
//     }
    
//     function displaySearchResults(results) {
//         const searchResultsContainer = document.createElement('div');
//         searchResultsContainer.id = 'searchResultsContainer';
//         searchResultsContainer.className = 'search-results-container';
    
//         if (results.length > 0) {
//             const resultList = document.createElement('ul');
//             resultList.className = 'search-results-list';
//             results.forEach(result => {
//                 const listItem = document.createElement('li');
//                 listItem.className = 'search-result-item';
//                 listItem.textContent = `${result.channel}: ${result.video}`;
//                 listItem.addEventListener('click', () => {
//                     currentChannel = result.channel;
//                     loadVideo(`/backup/${result.channel}/original_videos/${result.video}`, 
//                               `/backup/${result.channel}/generated_audios/${result.video.split('.').slice(0, -1).join('.')}.mp3`, 
//                               `/backup/${result.channel}/captions/${result.video.split('.').slice(0, -1).join('.')}.vtt`);
//                     clearSearchResults();
//                 });
//                 resultList.appendChild(listItem);
//             });
//             searchResultsContainer.appendChild(resultList);
//         } else {
//             searchResultsContainer.textContent = 'No videos found';
//         }
    
//         clearSearchResults();
//         document.querySelector('.main-content').insertBefore(searchResultsContainer, document.querySelector('.video-section'));
//     }
    
//     function clearSearchResults() {
//         const existingResults = document.getElementById('searchResultsContainer');
//         if (existingResults) {
//             existingResults.remove();
//         }
//     }

//     searchBar.addEventListener('input', handleSearch);

//     loadBackupChannels();
//     updateNotificationCount();
// });

// document.addEventListener('DOMContentLoaded', () => {
//     const channelSelector = document.getElementById('channelSelector');
//     const videoPlayer = document.getElementById('videoPlayer');
//     const muteToggle = document.getElementById('muteToggle');
//     const mp3VolumeControl = document.getElementById('mp3VolumeControl');
//     const mp3MuteToggle = document.getElementById('mp3MuteToggle');
//     const descriptionContainer = document.getElementById('descriptionContainer');
//     const searchBar = document.getElementById('searchBar');
//     const downloadCaptionsBtn = document.getElementById('downloadCaptionsBtn'); // Download Button
    
//     let audioContext;
//     let gainNode;
//     let audioElement;
//     let currentChannel;
//     let selectedVideoIndex = 0;
//     let videoList = [];

//     // Load the available backup channels
//     async function loadBackupChannels() {
//         try {
//             console.log("Fetching backup channels...");
//             const response = await fetch('/api/backup-channels');
//             if (!response.ok) {
//                 throw new Error(`Failed to fetch channels. Status: ${response.status}`);
//             }

//             const channels = await response.json();
//             console.log("Channels received:", channels);

//             if (Array.isArray(channels) && channels.length > 0) {
//                 populateChannelSelector(channels);
//             } else {
//                 throw new Error("No channels found in the response.");
//             }
//         } catch (error) {
//             console.error('Error loading backup channels:', error);
//             alert("Failed to load channels. Please check the console for details.");
//         }
//     }

//     // Populate the channel selector
//     function populateChannelSelector(channels) {
//         channelSelector.innerHTML = '<option value="">Select channel</option>';
//         channels.forEach(channel => {
//             const option = document.createElement('option');
//             option.value = channel.name;
//             option.textContent = channel.name;
//             channelSelector.appendChild(option);
//         });
//         channelSelector.addEventListener('change', (event) => handleChannelSelection(event, channels));
//     }

//     // Handle channel selection
//     function handleChannelSelection(event, channels) {
//         const selectedChannel = event.target.value;
//         console.log("Selected channel:", selectedChannel);
//         currentChannel = selectedChannel;

//         const selectedChannelData = channels.find(c => c.name === selectedChannel);
//         if (selectedChannelData && selectedChannelData.videos.length > 0) {
//             videoList = selectedChannelData.videos;
//             populateVideoSelector(videoList);
//         } else {
//             console.error("No videos found for the selected channel.");
//         }
//     }

//     // Populate the video selector
//     function populateVideoSelector(videos) {
//         const existingVideoSelectorContainer = document.querySelector('.video-selector-container');
//         if (existingVideoSelectorContainer) {
//             existingVideoSelectorContainer.remove();
//         }

//         const videoSelectorContainer = document.createElement('div');
//         videoSelectorContainer.className = 'video-selector-container';
//         videoSelectorContainer.innerHTML = `
//             <select id="videoSelect" class="video-select">
//                 <option value="">Select video</option>
//             </select>
//         `;

//         const select = videoSelectorContainer.querySelector('#videoSelect');
//         videos.forEach(video => {
//             const option = document.createElement('option');
//             option.value = video.video;
//             option.textContent = video.video;
//             select.appendChild(option);
//         });

//         select.addEventListener('change', handleVideoSelection);
//         channelSelector.parentNode.insertBefore(videoSelectorContainer, channelSelector.nextSibling);
//     }

//     // Handle video selection
//     function handleVideoSelection(event) {
//         const selectedVideo = event.target.value;
//         selectedVideoIndex = event.target.selectedIndex - 1;
//         if (selectedVideo) {
//             const baseName = selectedVideo.split('.').slice(0, -1).join('.');
//             const videoPath = `/backup/${currentChannel}/original_videos/${selectedVideo}`;
//             const captionsPath = `/backup/${currentChannel}/captions/${baseName}.vtt`;
//             const audioPath = `/backup/${currentChannel}/generated_audios/${baseName}.mp3`;
//             loadVideo(videoPath, audioPath, captionsPath);
//         }
//     }

//     // Load video and captions
//     function loadVideo(videoPath, audioPath, captionsPath) {
//         videoPlayer.src = videoPath;
//         videoPlayer.load();

//         if (audioElement) {
//             audioElement.pause();
//             audioElement.remove();
//         }

//         audioElement = new Audio(audioPath);
//         audioElement.load();

//         videoPlayer.onplay = () => audioElement.play();
//         videoPlayer.onpause = () => audioElement.pause();
//         videoPlayer.onseeked = () => {
//             audioElement.currentTime = videoPlayer.currentTime;
//         };

//         while (videoPlayer.firstChild) {
//             videoPlayer.removeChild(videoPlayer.firstChild);
//         }

//         const track = document.createElement('track');
//         track.kind = 'captions';
//         track.label = 'Subtitles';
//         track.srclang = 'en';
//         track.src = captionsPath;
//         track.default = true;
//         videoPlayer.appendChild(track);

//         fetch(captionsPath)
//             .then(response => response.text())
//             .then(captionsText => {
//                 descriptionContainer.innerHTML = parseVtt(captionsText);
//             })
//             .catch(error => console.error('Error loading captions:', error));
//     }

//     // Parse VTT captions into readable HTML
//     function parseVtt(vttText) {
//         const lines = vttText.split('\n');
//         let parsedHtml = '';
//         let isCaption = false;

//         for (let line of lines) {
//             if (line.includes('-->')) {
//                 isCaption = true;
//                 continue;
//             }
//             if (line.trim() === '' && isCaption) {
//                 isCaption = false;
//                 parsedHtml += '<br>';
//                 continue;
//             }
//             if (isCaption && line.trim() !== '') {
//                 parsedHtml += `<p>${line.trim()}</p>`;
//             }
//         }

//         return parsedHtml;
//     }

//     // Mute toggle
//     muteToggle.addEventListener('click', () => {
//         muteToggle.classList.toggle('active');
//         videoPlayer.muted = !videoPlayer.muted;
//     });

//     // MP3 Mute toggle
//     mp3MuteToggle.addEventListener('click', () => {
//         mp3MuteToggle.classList.toggle('active');
//         audioElement.muted = !audioElement.muted;
//     });

//     // MP3 volume control
//     mp3VolumeControl.addEventListener('input', () => {
//         if (gainNode) {
//             gainNode.gain.setValueAtTime(mp3VolumeControl.value, audioContext.currentTime);
//         }
//     });

//     // Download Captions functionality
//     async function downloadCaptions() {
//         const downloadCaptions = [];
//         const videosToDownload = videoList.slice(selectedVideoIndex, selectedVideoIndex + 12); // Select current video + next 11

//         for (const video of videosToDownload) {
//             const baseName = video.video.split('.').slice(0, -1).join('.');
//             const captionsPath = `/backup/${currentChannel}/captions/${baseName}.vtt`;
//             try {
//                 const response = await fetch(captionsPath);
//                 if (response.ok) {
//                     const captionsText = await response.text();
//                     downloadCaptions.push(`\nCaptions for: ${baseName}\n${captionsText}`);
//                 } else {
//                     downloadCaptions.push(`\nCaptions for: ${baseName}\n[Error: Captions not found]`);
//                 }
//             } catch (error) {
//                 console.error(`Error fetching captions for video: ${baseName}`, error);
//             }
//         }

//         const blob = new Blob([downloadCaptions.join('\n\n')], { type: 'text/plain' });
//         const downloadLink = document.createElement('a');
//         downloadLink.href = URL.createObjectURL(blob);
//         downloadLink.download = `captions_${currentChannel}.txt`;
//         downloadLink.click();
//     }

//     // Attach event listener to download button
//     downloadCaptionsBtn.addEventListener('click', downloadCaptions);

//     async function downloadMergedVideo() {
//         const selectedVideo = videoList[selectedVideoIndex]; // Get the currently selected video
//         const videosToMerge = videoList.slice(selectedVideoIndex, selectedVideoIndex + 12); // Get current + next 12
    
//         console.log('Merging the following videos:', videosToMerge); // Log the videos being merged
    
//         try {
//             const response = await fetch('/api/merge-videos', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({
//                     channel: currentChannel,
//                     videos: videosToMerge.map(v => v.video),
//                 }),
//             });
    
//             console.log('Response from merge API:', response);
    
//             if (!response.ok) {
//                 const errorData = await response.json();
//                 throw new Error(`Failed to merge videos. Server response: ${errorData.error}`);
//             }
    
//             const result = await response.json();
//             console.log('Merged video result:', result); // Log the result from the server
    
//             const downloadLink = document.createElement('a');
//             downloadLink.href = result.mergedVideoUrl; // URL from the server
//             downloadLink.download = 'merged_video.mp4';
//             downloadLink.click();
//         } catch (error) {
//             console.error('Error downloading merged video:', error.message); // Log the exact error message
//         }
//     }
    
//     // Attach event listener to the button
//     document.getElementById('downloadMergedVideoBtn').addEventListener('click', downloadMergedVideo);
    



//     // Call loadBackupChannels on page load
//     loadBackupChannels();
// });



document.addEventListener('DOMContentLoaded', () => {
    const channelSelector = document.getElementById('channelSelector');
    const videoPlayer = document.getElementById('videoPlayer');
    const muteToggle = document.getElementById('muteToggle');
    const mp3VolumeControl = document.getElementById('mp3VolumeControl');
    const mp3MuteToggle = document.getElementById('mp3MuteToggle');
    const descriptionContainer = document.getElementById('descriptionContainer');
    const searchBar = document.getElementById('searchBar');
    const downloadCaptionsBtn = document.getElementById('downloadCaptionsBtn');
    const downloadMergedVideoBtn = document.getElementById('downloadMergedVideoBtn');
    const searchResultsContainer = document.createElement('div'); // Container for search results

    searchResultsContainer.id = 'searchResultsContainer';
    searchResultsContainer.style.marginTop = '10px';
    searchResultsContainer.style.background = '#1e1e1e';
    searchResultsContainer.style.color = '#fff';
    searchResultsContainer.style.borderRadius = '5px';
    searchResultsContainer.style.padding = '10px';
    searchResultsContainer.style.maxHeight = '200px';
    searchResultsContainer.style.overflowY = 'auto';

    searchBar.parentNode.appendChild(searchResultsContainer); // Add container below search bar

    let audioContext;
    let gainNode;
    let audioElement;
    let currentChannel;
    let videoList = []; // Store videos for the selected channel

    // Add start and end video selectors
    const startVideoSelect = document.createElement('select');
    startVideoSelect.id = 'startVideoSelect';
    startVideoSelect.className = 'video-select';
    const endVideoSelect = document.createElement('select');
    endVideoSelect.id = 'endVideoSelect';
    endVideoSelect.className = 'video-select';

    // Load the available backup channels
    async function loadBackupChannels() {
        try {
            console.log("Fetching backup channels...");
            const response = await fetch('/api/backup-channels');
            if (!response.ok) {
                throw new Error(`Failed to fetch channels. Status: ${response.status}`);
            }

            const channels = await response.json();
            console.log("Channels received:", channels);

            if (Array.isArray(channels) && channels.length > 0) {
                populateChannelSelector(channels);
            } else {
                throw new Error("No channels found in the response.");
            }
        } catch (error) {
            console.error('Error loading backup channels:', error);
            alert("Failed to load channels. Please check the console for details.");
        }
    }

    // Populate the channel selector
    function populateChannelSelector(channels) {
        channelSelector.innerHTML = '<option value="">Select channel</option>';
        channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.name;
            option.textContent = channel.name;
            channelSelector.appendChild(option);
        });
        channelSelector.addEventListener('change', (event) => handleChannelSelection(event, channels));
    }

    // Handle channel selection
    function handleChannelSelection(event, channels) {
        const selectedChannel = event.target.value;
        console.log("Selected channel:", selectedChannel);
        currentChannel = selectedChannel;

        const selectedChannelData = channels.find(c => c.name === selectedChannel);
        if (selectedChannelData && selectedChannelData.videos.length > 0) {
            videoList = selectedChannelData.videos;
            populateVideoSelector(videoList);
        } else {
            videoList = []; // Clear video list if no videos are found
            populateVideoSelector(videoList);
            console.error("No videos found for the selected channel.");
        }
    }

    // Populate the video selector and start/end selectors
    function populateVideoSelector(videos) {
        const existingVideoSelectorContainer = document.querySelector('.video-selector-container');
        if (existingVideoSelectorContainer) {
            existingVideoSelectorContainer.remove();
        }

        const videoSelectorContainer = document.createElement('div');
        videoSelectorContainer.className = 'video-selector-container';
        videoSelectorContainer.innerHTML = `
            <select id="videoSelect" class="video-select">
                <option value="">Select video</option>
            </select>
        `;

        const select = videoSelectorContainer.querySelector('#videoSelect');
        videos.forEach((video, index) => {
            const option = document.createElement('option');
            option.value = video.video;
            option.textContent = video.video;
            select.appendChild(option);

            // Populate start and end video selectors
            const startOption = document.createElement('option');
            startOption.value = index;
            startOption.textContent = video.video;
            startVideoSelect.appendChild(startOption);

            const endOption = document.createElement('option');
            endOption.value = index;
            endOption.textContent = video.video;
            endVideoSelect.appendChild(endOption);
        });

        select.addEventListener('change', handleVideoSelection);
        channelSelector.parentNode.insertBefore(videoSelectorContainer, channelSelector.nextSibling);

        // Insert start and end selectors into the DOM
        const videoSection = document.querySelector('.video-section');
        videoSection.insertBefore(startVideoSelect, downloadMergedVideoBtn);
        videoSection.insertBefore(endVideoSelect, downloadMergedVideoBtn);
    }

    // Handle video selection
    function handleVideoSelection(event) {
        const selectedVideo = event.target.value;
        if (selectedVideo) {
            const baseName = selectedVideo.split('.').slice(0, -1).join('.');
            const videoPath = `/backup/${currentChannel}/original_videos/${selectedVideo}`;
            const captionsPath = `/backup/${currentChannel}/captions/${baseName}.vtt`;
            const audioPath = `/backup/${currentChannel}/generated_audios/${baseName}.mp3`;
            loadVideo(videoPath, audioPath, captionsPath);
        }
    }

    // Load video and captions
    function loadVideo(videoPath, audioPath, captionsPath) {
        videoPlayer.src = videoPath;
        videoPlayer.load();

        if (audioElement) {
            audioElement.pause();
            audioElement.remove();
        }

        audioElement = new Audio(audioPath);
        audioElement.load();

        videoPlayer.onplay = () => audioElement.play();
        videoPlayer.onpause = () => audioElement.pause();
        videoPlayer.onseeked = () => {
            audioElement.currentTime = videoPlayer.currentTime;
        };

        while (videoPlayer.firstChild) {
            videoPlayer.removeChild(videoPlayer.firstChild);
        }

        const track = document.createElement('track');
        track.kind = 'captions';
        track.label = 'Subtitles';
        track.srclang = 'en';
        track.src = captionsPath;
        track.default = true;
        videoPlayer.appendChild(track);

        fetch(captionsPath)
            .then(response => response.text())
            .then(captionsText => {
                descriptionContainer.innerHTML = parseVtt(captionsText);
            })
            .catch(error => console.error('Error loading captions:', error));
    }

    // Parse VTT captions into readable HTML
    function parseVtt(vttText) {
        const lines = vttText.split('\n');
        let parsedHtml = '';
        let isCaption = false;

        for (let line of lines) {
            if (line.includes('-->')) {
                isCaption = true;
                continue;
            }
            if (line.trim() === '' && isCaption) {
                isCaption = false;
                parsedHtml += '<br>';
                continue;
            }
            if (isCaption && line.trim() !== '') {
                parsedHtml += `<p>${line.trim()}</p>`;
            }
        }

        return parsedHtml;
    }

    searchBar.addEventListener('input', async () => {
        const searchTerm = searchBar.value.trim().toLowerCase();
        if (!searchTerm) {
            searchResultsContainer.innerHTML = '<div>No matching videos found.</div>';
            return;
        }
    
        let videosToSearch = videoList; // Default to the current channel's videos
    
        // If no channel is selected, fetch videos from all channels
        if (!currentChannel) {
            try {
                const response = await fetch('/api/backup-channels');
                if (!response.ok) {
                    throw new Error('Failed to fetch backup channels');
                }
                const allChannels = await response.json();
                videosToSearch = allChannels.flatMap(channel => 
                    channel.videos.map(video => ({
                        ...video,
                        channel: channel.name // Add channel name for global search results
                    }))
                );
            } catch (error) {
                console.error('Error fetching all backup channels:', error.message);
                searchResultsContainer.innerHTML = '<div>Error loading videos for search.</div>';
                return;
            }
        }
    
        // Filter videos by search term
        const filteredVideos = videosToSearch.filter(video => {
            const videoName = video.video.toLowerCase();
            const numericPart = videoName.match(/\d+/)?.[0]; // Extract numeric part
            return videoName.includes(searchTerm) || (numericPart && numericPart.includes(searchTerm));
        });
    
        // Display search results
        if (filteredVideos.length > 0) {
            searchResultsContainer.innerHTML = filteredVideos
                .map(video => `
                    <div class="search-result">
                        <p>${video.channel ? `${video.channel}: ` : ''}${video.video}</p>
                        <button onclick="loadSelectedVideo('${video.channel || currentChannel}', '${video.video}')">Play</button>
                    </div>
                `)
                .join('');
        } else {
            searchResultsContainer.innerHTML = '<div>No matching videos found.</div>';
        }
    });

    
    window.loadSelectedVideo = (channel, videoFile) => {
        if (!channel) {
            console.error('Channel information is missing for the selected video.');
            return;
        }
    
        const baseName = videoFile.split('.').slice(0, -1).join('.');
        const videoPath = `/backup/${channel}/original_videos/${videoFile}`;
        const captionsPath = `/backup/${channel}/captions/${baseName}.vtt`;
        const audioPath = `/backup/${channel}/generated_audios/${baseName}.mp3`;
    
        loadVideo(videoPath, audioPath, captionsPath);
    };

    function displaySearchResults(results) {
        searchResultsContainer.innerHTML = '';
    
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<div>No matching videos found.</div>';
            return;
        }
    
        results.forEach((result) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.style.padding = '5px';
            resultItem.style.borderBottom = '1px solid #444';
            resultItem.textContent = `${result.channel}: ${result.video}`;
            resultItem.addEventListener('click', () => {
                loadVideo(result.videoPath, null, null); // Load the video directly
            });
            searchResultsContainer.appendChild(resultItem);
        });
    }
    
    
    // Mute toggle
    muteToggle.addEventListener('click', () => {
        muteToggle.classList.toggle('active');
        videoPlayer.muted = !videoPlayer.muted;
    });

    // MP3 Mute toggle
    mp3MuteToggle.addEventListener('click', () => {
        mp3MuteToggle.classList.toggle('active');
        audioElement.muted = !audioElement.muted;
    });

    // MP3 volume control
    mp3VolumeControl.addEventListener('input', () => {
        if (gainNode) {
            gainNode.gain.setValueAtTime(mp3VolumeControl.value, audioContext.currentTime);
        }
    });

    // Download captions functionality
    downloadCaptionsBtn.addEventListener('click', async () => {
        const downloadCaptions = [];
        const videosToDownload = videoList.slice(0, 12); // First 12 videos

        for (const video of videosToDownload) {
            const baseName = video.video.split('.').slice(0, -1).join('.');
            const captionsPath = `/backup/${currentChannel}/captions/${baseName}.vtt`;
            try {
                const response = await fetch(captionsPath);
                if (response.ok) {
                    const captionsText = await response.text();
                    downloadCaptions.push(`\nCaptions for: ${baseName}\n${captionsText}`);
                } else {
                    downloadCaptions.push(`\nCaptions for: ${baseName}\n[Error: Captions not found]`);
                }
            } catch (error) {
                console.error(`Error fetching captions for video: ${baseName}`, error);
            }
        }

        const blob = new Blob([downloadCaptions.join('\n\n')], { type: 'text/plain' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `captions_${currentChannel}.txt`;
        downloadLink.click();
    });

    // Download merged video functionality
    downloadMergedVideoBtn.addEventListener('click', async () => {
        const startIndex = parseInt(startVideoSelect.value, 10);
        const endIndex = parseInt(endVideoSelect.value, 10);

        if (isNaN(startIndex) || isNaN(endIndex) || startIndex > endIndex) {
            alert("Please select a valid range of videos (start video must be before or equal to end video).");
            return;
        }

        const videosToMerge = videoList.slice(startIndex, endIndex + 1);

        try {
            const response = await fetch('/api/merge-videos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    channel: currentChannel,
                    videos: videosToMerge.map(v => v.video),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to merge videos. Server response: ${errorData.error}`);
            }

            const result = await response.json();

            // Create download link for the merged video
            const downloadVideoLink = document.createElement('a');
            downloadVideoLink.href = result.mergedVideoUrl;
            downloadVideoLink.download = 'merged_video.mp4';
            downloadVideoLink.click();

            // Create download link for the merged captions
            const downloadCaptionsLink = document.createElement('a');
            downloadCaptionsLink.href = result.mergedCaptionsUrl;
            downloadCaptionsLink.download = 'merged_captions.vtt';
            downloadCaptionsLink.click();

        } catch (error) {
            console.error('Error downloading merged video and captions:', error.message);
        }
    });

    // Call loadBackupChannels on page load
    loadBackupChannels();
});
