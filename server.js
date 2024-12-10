const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const axios = require('axios');
const app = express();
const PORT = 3000;
const videosDir = path.join(__dirname, 'videos');
const backupDir = path.join(__dirname, 'backup');
const publicDir = path.join(__dirname, 'public');
const notificationDir = path.join(__dirname, 'notification');
const KEYWORDS_FILE = path.join(__dirname, 'keywords.json');
const { Worker } = require('worker_threads');



const execPromise = util.promisify(exec);
const REMOTE_SERVER_URL = 'http://192.168.1.7:4000';

const { LRUCache } = require('lru-cache');


const cache = new LRUCache({

  max: 100, 
  ttl: 5 * 60 * 1000, 
});

console.log('Cache initialized:', cache);

// Cache test
cache.set('test', 'This is a test value');
const testValue = cache.get('test');
console.log('Cached value for "test":', testValue);


// Function to check if GC is available
if (global.gc) {
  console.log('Garbage collection is available.');
} else {
  console.warn('Garbage collection is NOT available.');
}

// Global error handlers for unhandled exceptions and rejections
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Optionally restart server or handle the error appropriately
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});



const tempDir = path.join(__dirname, 'temp');

// Ensure the temp directory exists
fs.mkdir(tempDir, { recursive: true })
    .then(() => console.log(`Temp directory created or already exists: ${tempDir}`))
    .catch(err => console.error(`Error creating temp directory: ${err.message}`));


app.use(express.json());
app.use(express.static(publicDir));
app.use('/videos', express.static(videosDir));
app.use('/backup', express.static(backupDir));
app.use('/notification', express.static(notificationDir));
app.use('/temp', express.static(tempDir));

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch (error) {
        return false;
    }
}


// async function searchVttFiles(searchWord) {
//     const results = [];
//     const backupPath = path.join(__dirname, 'backup');

//     try {
//         const channels = await fs.readdir(backupPath);

//         for (const channel of channels) {
//             const channelPath = path.join(backupPath, channel);
//             const vttPath = path.join(channelPath, 'captions');
//             const videoPath = path.join(channelPath, 'original_videos');
//             const audioPath = path.join(channelPath, 'generated_audios');

//             if (!(await fileExists(vttPath))) {
//                 log(`Captions path does not exist: ${vttPath}`);
//                 continue;
//             }

//             const vttFiles = await fs.readdir(vttPath);

//             for (const vttFile of vttFiles) {
//                 const vttContent = await fs.readFile(path.join(vttPath, vttFile), 'utf-8');
//                 if (vttContent.toLowerCase().includes(searchWord.toLowerCase())) {
//                     const baseName = path.basename(vttFile, '.vtt');
//                     results.push({
//                         channel,
//                         vtt: `/backup/${channel}/captions/${vttFile}`,
//                         video: `/backup/${channel}/original_videos/${baseName}.mp4`,
//                         audio: `/backup/${channel}/generated_audios/${baseName}.mp3`,
//                         timestamp: baseName.split('_').pop()
//                     });
//                 }
//             }
//         }
//     } catch (error) {
//         console.error('Error searching VTT files:', error);
//     }

//     return results;
// }


// Cache channels to reduce frequent I/O
async function getCachedChannels() {
    const currentTime = Date.now();
    const cachedChannels = cache.get('channels');
    if (cachedChannels) {
        return cachedChannels;
    }
  
    const files = await fs.readdir(videosDir, { withFileTypes: true });
    cachedChannels = await Promise.all(
      files
        .filter(dirent => dirent.isDirectory())
        .map(async dirent => {
          const channelPath = path.join(videosDir, dirent.name);
          const originalVideosPath = path.join(channelPath, 'original_videos');
          const originalVideos = await fs.readdir(originalVideosPath);
          return {
            name: dirent.name,
            videos: originalVideos.filter(file => file.endsWith('.mp4')),
          };
        })
    );
    cacheTime = currentTime;
      // Store the fetched channels in the cache
    cache.set('channels', cachedChannels); // <-- Add cache assignment here
    return cachedChannels;
  }

  function searchVttInWorker(searchWord) {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./searchWorker.js', {
            workerData: { searchWord },
        });

        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
    });
}

// Optimized Search VTT Files using streaming
async function searchVttFiles(searchWord) {
    const results = [];
    const backupPath = path.join(__dirname, 'backup');
    const batchSize = 500; // Process in batches

    try {
        const channels = await fs.readdir(backupPath);
        for (const channel of channels) {
            const vttPath = path.join(backupPath, channel, 'captions');
            if (!(await fileExists(vttPath))) continue;

            const vttFiles = await fs.readdir(vttPath);

            // Process files in batches
            for (let i = 0; i < vttFiles.length; i += batchSize) {
                const batch = vttFiles.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(async (vttFile) => {
                        const filePath = path.join(vttPath, vttFile);
                        const fileContent = await fs.readFile(filePath, 'utf-8');

                        if (fileContent.toLowerCase().includes(searchWord.toLowerCase())) {
                            const baseName = path.basename(vttFile, '.vtt');
                            const videoFilePath = path.join(backupPath, channel, 'original_videos', `${baseName}.mp4`);
                            const stats = await fs.stat(videoFilePath);

                            results.push({
                                channel,
                                vtt: `/backup/${channel}/captions/${vttFile}`,
                                video: `/backup/${channel}/original_videos/${baseName}.mp4`,
                                audio: `/backup/${channel}/generated_audios/${baseName}.mp3`,
                                timestamp: baseName.split('_').pop(),
                                creationTime: stats.ctime.toLocaleString(),
                            });
                        }
                    })
                );
            }
        }
    } catch (error) {
        console.error('Error searching VTT files:', error);
    }

    return results;
}


//   // Fetching cached channels
// app.get('/api/channels', async (req, res) => {
//     try {
//       const channels = await getCachedChannels();
//       res.json(channels);
//     } catch (err) {
//       log(`Error fetching channels: ${err.message}`);
//       res.status(500).json({ error: 'Failed to fetch channels' });
//     }
//   });

async function searchVttFilesByChannel(searchWord, channel) {
    const results = [];
    const backupPath = path.join(__dirname, 'backup', channel, 'captions');

    try {
        if (!(await fileExists(backupPath))) {
            return results; // Return an empty result if no captions are found
        }

        const vttFiles = await fs.readdir(backupPath);

        for (const vttFile of vttFiles) {
            const vttContent = await fs.readFile(path.join(backupPath, vttFile), 'utf-8');
            if (vttContent.toLowerCase().includes(searchWord.toLowerCase())) {
                const baseName = path.basename(vttFile, '.vtt');
                const videoFilePath = path.join(backupPath, '..', 'original_videos', `${baseName}.mp4`);
                const stats = await fs.stat(videoFilePath);

                results.push({
                    channel,
                    vtt: `/backup/${channel}/captions/${vttFile}`,
                    video: `/backup/${channel}/original_videos/${baseName}.mp4`,
                    audio: `/backup/${channel}/generated_audios/${baseName}.mp3`,
                    timestamp: baseName.split('_').pop(),
                    creationTime: stats.ctime.toLocaleString(),
                });
            }
        }
    } catch (error) {
        console.error('Error searching VTT files for channel:', error);
    }

    return results;
}


app.get('/api/search-backup', async (req, res) => {
    const searchTerm = req.query.term ? req.query.term.toLowerCase() : '';
    const selectedChannel = req.query.channel || 'all'; // Default to 'all'

    if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
    }

    try {
        const results = [];
        const backupPath = path.join(__dirname, 'backup');

        if (selectedChannel !== 'all') {
            // Search in a specific channel
            const channelPath = path.join(backupPath, selectedChannel);
            if (await fileExists(channelPath)) {
                results.push(...(await searchInChannel(channelPath, searchTerm, selectedChannel)));
            }
        } else {
            // Search across all channels
            const channels = await fs.readdir(backupPath, { withFileTypes: true });
            for (const channel of channels.filter((dirent) => dirent.isDirectory())) {
                const channelPath = path.join(backupPath, channel.name);
                results.push(...(await searchInChannel(channelPath, searchTerm, channel.name)));
            }
        }

        res.json(results);
    } catch (error) {
        console.error('Error in /api/search-backup:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function searchInChannel(channelPath, searchTerm, channelName) {
    const results = [];
    try {
        const videosPath = path.join(channelPath, 'original_videos');
        if (!(await fileExists(videosPath))) return results;

        const files = await fs.readdir(videosPath);
        for (const file of files) {
            if (file.toLowerCase().includes(searchTerm)) {
                results.push({
                    channel: channelName,
                    video: file,
                    videoPath: `/backup/${channelName}/original_videos/${file}`,
                });
            }
        }
    } catch (error) {
        console.error(`Error searching in channel ${channelName}:`, error.message);
    }
    return results;
}





app.get('/api/search', async (req, res) => {
    const searchWord = req.query.word;
    const selectedChannel = req.query.channel;

    if (!searchWord) {
        return res.status(400).json({ error: 'Search word is required' });
    }

    try {
        let results;
        if (selectedChannel && selectedChannel !== 'all') {
            // If a specific channel is selected, search only in that channel
            results = await searchVttFilesByChannel(searchWord, selectedChannel);
        } else {
            // If no specific channel is selected, search in all channels
            results = await searchVttFiles(searchWord);
        }
        res.json(results);
    } catch (error) {
        console.error('Error in search API:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Offload CPU-bound tasks to worker threads
function runFfmpeg(fileListPath, outputVideoPath) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./ffmpegWorker.js', {
        workerData: { fileListPath, outputVideoPath },
      });
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
        }
        worker.terminate(); // Terminate the worker to release resources
    });
    
    });
  }

function processNotificationsInWorker() {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./processNotificationsWorker.js');
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
            worker.terminate();
        });
    });
}


async function processNotifications() {
    try {
        const notifications = JSON.parse(await fs.readFile(path.join(__dirname, 'notifications.json'), 'utf-8'));
        const keywords = [...new Set(notifications.map(n => n.keyword))];

        await processNotificationsInWorker();

        await fs.mkdir(notificationDir, { recursive: true });

        for (const keyword of keywords) {
            const keywordPath = path.join(notificationDir, keyword);
            await fs.mkdir(keywordPath, { recursive: true });

            const filteredNotifications = notifications.filter(n => n.keyword === keyword);

            for (const notification of filteredNotifications) {
                const { channel, timestamp } = notification;
                const channelPath = path.join(keywordPath, channel);
                await fs.mkdir(channelPath, { recursive: true });

                const videoDir = path.join(channelPath, 'original_videos');
                const audioDir = path.join(channelPath, 'generated_audios');
                const captionsDir = path.join(channelPath, 'captions');

                await fs.mkdir(videoDir, { recursive: true });
                await fs.mkdir(audioDir, { recursive: true });
                await fs.mkdir(captionsDir, { recursive: true });

                const fileBaseName = `${channel}_${timestamp}`;
                const sourceDirs = [videosDir, backupDir];

                await Promise.all(sourceDirs.map(async (dir) => {
                    const videoPath = path.join(dir, channel, 'original_videos', `${fileBaseName}.mp4`);
                    const audioPath = path.join(dir, channel, 'generated_audios', `${fileBaseName}.mp3`);
                    const captionsPath = path.join(dir, channel, 'captions', `${fileBaseName}.vtt`);

                    if (videoPath && (await fileExists(videoPath))) {
                        await fs.copyFile(videoPath, path.join(videoDir, `${fileBaseName}.mp4`));
                        log(`Copied ${videoPath} to ${path.join(videoDir, `${fileBaseName}.mp4`)}`);
                    } else {
                        log(`Video path is undefined or does not exist: ${videoPath}`);
                    }

                    if (audioPath && (await fileExists(audioPath))) {
                        await fs.copyFile(audioPath, path.join(audioDir, `${fileBaseName}.mp3`));
                        log(`Copied ${audioPath} to ${path.join(audioDir, `${fileBaseName}.mp3`)}`);
                    } else {
                        log(`Audio path is undefined or does not exist: ${audioPath}`);
                    }

                    if (captionsPath && (await fileExists(captionsPath))) {
                        await fs.copyFile(captionsPath, path.join(captionsDir, `${fileBaseName}.vtt`));
                        log(`Copied ${captionsPath} to ${path.join(captionsDir, `${fileBaseName}.vtt`)}`);
                    } else {
                        log(`Captions path is undefined or does not exist: ${captionsPath}`);
                    }
                }));
            }
        }
        if (global.gc) {
            global.gc(); // Call garbage collection
        } else {
            console.warn('Garbage collection unavailable. Run Node with --expose-gc');
        }
        
    } catch (error) {
        log(`Error processing notifications: ${error.message}`);
    }
}

app.get('/api/channels', async (req, res) => {
    try {
        log('Fetching channels');
        const files = await fs.readdir(videosDir, { withFileTypes: true });
        const channels = await Promise.all(files
            .filter(dirent => dirent.isDirectory())
            .map(async dirent => {
                const channelPath = path.join(videosDir, dirent.name);
                const originalVideosPath = path.join(channelPath, 'original_videos');
                const originalVideos = await fs.readdir(originalVideosPath);
                const videos = originalVideos
                    .filter(file => file.endsWith('.mp4'))
                    .sort()
                    .map(file => {
                        const baseName = path.basename(file, '.mp4');
                        return {
                            video: file,
                            audio: `${baseName}.mp3`,
                            captions: `${baseName}.vtt`
                        };
                    });
                return {
                    name: dirent.name,
                    videos
                };
            }));
        log(`Found ${channels.length} channels`);
        res.json(channels);
    } catch (err) {
        log(`Error reading channels: ${err.message}`);
        res.status(500).json({ error: 'Failed to read directory', details: err.message });
    }
});
app.get('/api/channels/:channelName/latest', async (req, res) => {
    const { channelName } = req.params;
    const originalVideosPath = path.join(videosDir, channelName, 'original_videos');

    try {
        log(`Fetching latest video for channel ${channelName}`);

        if (!(await fileExists(originalVideosPath))) {
            return res.status(404).json({ error: `Channel ${channelName} not found` });
        }

        const originalVideos = await fs.readdir(originalVideosPath);

        // Sort videos by creation time and select the most recent one
        const latestVideo = originalVideos
            .filter(file => file.endsWith('.mp4'))
            .map(file => ({
                file,
                time: fs.stat(path.join(originalVideosPath, file)).then(stats => stats.mtime) // Get modification time
            }));

        // Wait for the modification times to be available and then sort
        const sortedVideos = (await Promise.all(latestVideo)).sort((a, b) => b.time - a.time);
        const latestFile = sortedVideos[0]?.file;

        if (!latestFile) {
            return res.status(404).json({ error: 'No videos found for this channel' });
        }

        const baseName = path.basename(latestFile, '.mp4');
        const videoPath = `/videos/${channelName}/original_videos/${latestFile}`;
        const audioPath = `/videos/${channelName}/generated_audios/${baseName}.mp3`;
        const captionsPath = `/videos/${channelName}/captions/${baseName}.vtt`;

        res.json({
            video: videoPath,
            audio: await fileExists(path.join(videosDir, channelName, 'generated_audios', `${baseName}.mp3`)) ? audioPath : null,
            captions: await fileExists(path.join(videosDir, channelName, 'captions', `${baseName}.vtt`)) ? captionsPath : null
        });

    } catch (err) {
        log(`Error fetching latest video for channel ${channelName}: ${err.message}`);
        res.status(500).json({ error: 'Failed to get latest video', details: err.message });
    }
});

app.post('/api/moveToBackup', async (req, res) => {
    if (!req.body || !req.body.channelName || !req.body.fileName) {
        return res.status(400).json({ error: 'Missing required fields in request body' });
    }

    const { channelName, fileName } = req.body;
    try {
        log(`Moving files to backup for channel: ${channelName}, file: ${fileName}`);
        const sourcePath = path.join(videosDir, channelName);
        const destPath = path.join(backupDir, channelName);
        await fs.mkdir(destPath, { recursive: true });

        const baseName = path.basename(fileName, '.mp4');
        const filesToMove = [
            { src: path.join(sourcePath, 'original_videos', `${baseName}.mp4`), dest: path.join(destPath, 'original_videos') },
            { src: path.join(sourcePath, 'generated_audios', `${baseName}.mp3`), dest: path.join(destPath, 'generated_audios') },
            { src: path.join(sourcePath, 'captions', `${baseName}.vtt`), dest: path.join(destPath, 'captions') }
        ];

        await Promise.all(filesToMove.map(async file => {
            try {
                await fs.mkdir(file.dest, { recursive: true });
                await fs.rename(file.src, path.join(file.dest, path.basename(file.src)));
                log(`Moved ${path.basename(file.src)} to backup`);
            } catch (err) {
                log(`Error moving ${path.basename(file.src)}: ${err.message}`);
            }
        }));

        res.json({ success: true });
    } catch (err) {
        log(`Error moving files to backup: ${err.message}`);
        res.status(500).json({ error: 'Failed to move files', details: err.message });
    }
});



app.get('/api/videoDuration/:channelName/:fileName', async (req, res) => {
    const { channelName, fileName } = req.params;
    const videoPath = path.join(videosDir, channelName, 'original_videos', fileName);

    try {
        if (!(await fileExists(videoPath))) {
            console.error(`Video file not found: ${videoPath}`);
            return res.status(404).json({ error: 'Video file not found' });
        }

        // Double-check before accessing the file
        if (!(await fileExists(videoPath))) {
            console.error(`Video file removed or missing before access: ${videoPath}`);
            return res.status(404).json({ error: 'Video file removed or missing' });
        }

        console.log(`Getting duration for video: ${videoPath}`);
        const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`);
        const duration = parseFloat(stdout);
        console.log(`Video duration: ${duration} seconds`);
        res.json({ duration });
    } catch (err) {
        console.error(`Error fetching video duration or file not found: ${err.message}`);
        res.status(500).json({ error: 'Failed to get video duration', details: err.message });
    }
});



// Efficient Notifications Processing with fs.watch and Event-based Updates
const notificationsFilePath = path.join(__dirname, 'notifications.json');
fs.watch(notificationsFilePath, async (eventType, filename) => {
  if (eventType === 'change') {
    try {
      log('Notifications file updated, processing...');
      await processNotifications(); // Assume this function is defined elsewhere
    } catch (err) {
      log(`Error processing notifications: ${err.message}`);
    }
  }
});
app.get('/api/notifications', async (req, res) => {
    try {
        const notificationData = {};
        const notifications = JSON.parse(await fs.readFile(notificationsFilePath, 'utf-8'));

        for (const notification of notifications) {
            const { keyword, channel, timestamp } = notification;
            if (!notificationData[keyword]) {
                notificationData[keyword] = {};
            }
            if (!notificationData[keyword][channel]) {
                notificationData[keyword][channel] = [];
            }

            const fileBaseName = `${channel}_${timestamp}`;
            const videoPath = path.join(notificationDir, keyword, channel, 'original_videos', `${fileBaseName}.mp4`);
            const audioPath = path.join(notificationDir, keyword, channel, 'generated_audios', `${fileBaseName}.mp3`);
            const captionsPath = path.join(notificationDir, keyword, channel, 'captions', `${fileBaseName}.vtt`);

            // Checking if all required files exist
            if (await fileExists(videoPath) && await fileExists(audioPath) && await fileExists(captionsPath)) {
                notificationData[keyword][channel].push({
                    video: `/notification/${keyword}/${channel}/original_videos/${fileBaseName}.mp4`,
                    audio: `/notification/${keyword}/${channel}/generated_audios/${fileBaseName}.mp3`,
                    captions: `/notification/${keyword}/${channel}/captions/${fileBaseName}.vtt`,
                    timestamp: timestamp
                });
            } else {
                log(`Missing files for ${fileBaseName}. Video: ${await fileExists(videoPath)}, Audio: ${await fileExists(audioPath)}, Captions: ${await fileExists(captionsPath)}`);
            }
        }

        res.json(notificationData);
    } catch (err) {
        log(`Error reading notifications: ${err.message}`);
        res.status(500).json({ error: 'Failed to read notifications', details: err.message });
    }
});

app.post('/api/removeNotification', async (req, res) => {
    const { keyword, channel, timestamp } = req.body;
    try {
        const notifications = JSON.parse(await fs.readFile(notificationsFilePath, 'utf-8'));
        const updatedNotifications = notifications.filter(n =>
            !(n.keyword === keyword && n.channel === channel && n.timestamp === timestamp)
        );
        await fs.writeFile(notificationsFilePath, JSON.stringify(updatedNotifications, null, 2));
        res.json({ success: true });
    } catch (err) {
        log(`Error removing notification: ${err.message}`);
        res.status(500).json({ error: 'Failed to remove notification', details: err.message });
    }
});

// New route to count notifications
app.get('/api/notifications/count', async (req, res) => {
    try {
        const notifications = JSON.parse(await fs.readFile(notificationsFilePath, 'utf-8'));
        const count = notifications.length;
        res.json({ count });
    } catch (err) {
        log(`Error counting notifications: ${err.message}`);
        res.status(500).json({ error: 'Failed to count notifications', details: err.message });
    }
});

// app.get('/api/notifications/list', async (req, res) => {
//     try {
//         const notifications = JSON.parse(await fs.readFile(notificationsFilePath, 'utf-8'));
//         const notificationDetails = notifications.map(n => ({
//             keyword: n.keyword,
//             channel: n.channel,
//             timestamp: n.timestamp
//         }));
//         res.json(notificationDetails);
//     } catch (err) {
//         log(`Error getting notification list: ${err.message}`);
//         res.status(500).json({ error: 'Failed to get notifications', details: err.message });
//     }
// });
app.get('/api/notifications/list', async (req, res) => {
    try {
        const notifications = JSON.parse(await fs.readFile(notificationsFilePath, 'utf-8'));

        // Group notifications by keyword
        const groupedNotifications = notifications.reduce((acc, notification) => {
            const { keyword } = notification;
            if (!acc[keyword]) {
                acc[keyword] = [];
            }
            acc[keyword].push(notification);
            return acc;
        }, {});

        res.json(groupedNotifications);
    } catch (err) {
        log(`Error getting notification list: ${err.message}`);
        res.status(500).json({ error: 'Failed to get notifications', details: err.message });
    }
});


const NOTIFICATION_UPDATE_INTERVAL = 1000 * 10;

app.get('/api/highlights/:keyword/:channel/:timestamp', async (req, res) => {
    const { keyword, channel, timestamp } = req.params;
    const vttPath = path.join(notificationDir, keyword, channel, 'captions', `${channel}_${timestamp}.vtt`);

    try {
        if (await fileExists(vttPath)) {
            const highlights = await searchKeywordsInVTT(vttPath, [keyword]);
            res.json(highlights);
        } else {
            log(`VTT file not found: ${vttPath}`);
            res.status(404).json({ error: 'VTT file not found' });
        }
    } catch (err) {
        log(`Error getting highlights: ${err.message}`);
        res.status(500).json({ error: 'Failed to get highlights', details: err.message });
    }
});

async function searchKeywordsInVTT(vttPath, keywords) {
    try {
        const content = await fs.readFile(vttPath, 'utf-8');
        const lines = content.split('\n');
        const highlights = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            for (const keyword of keywords) {
                if (line.includes(keyword.toLowerCase())) {
                    highlights.push({
                        keyword: keyword,
                        line: i + 1
                    });
                }
            }
        }

        return highlights;
    } catch (error) {
        log(`Error searching keywords in VTT: ${error.message}`);
        return [];
    }
}

setInterval(() => {
    processNotifications().then(() => {
        log('Notifications updated successfully');
    }).catch(err => {
        log(`Error updating notifications: ${err.message}`);
    });
}, NOTIFICATION_UPDATE_INTERVAL);

processNotifications().then(() => {
    log('Notifications processed successfully');
}).catch(err => {
    log(`Error processing notifications: ${err.message}`);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/notifications', (req, res) => {
    res.sendFile(path.join(publicDir, 'notifications.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(publicDir, 'search.html'));
});

app.listen(PORT, () => {
    log(`Server is running on http://localhost:${PORT}`);
});

// New API route to update keywords
app.post('/api/keywords', async (req, res) => {
    try {
        const newKeywords = req.body;
        if (!Array.isArray(newKeywords)) {
            console.error('Invalid keyword data received');
            return res.status(400).json({ error: 'Invalid keyword data' });
        }

        console.log(`Received new keywords: ${JSON.stringify(newKeywords)}`);

        let existingKeywords = await readJsonFile(KEYWORDS_FILE) || [];
        if (!Array.isArray(existingKeywords)) {
            console.warn('Existing keywords data is not an array. Initializing to an empty array.');
            existingKeywords = [];
        }

        const updatedKeywords = [...new Set([...existingKeywords, ...newKeywords])];

        await writeJsonFile(KEYWORDS_FILE, updatedKeywords);
        console.log('Keywords updated successfully');

        // Send updated keywords to the remote server
        await axios.post(`${REMOTE_SERVER_URL}/api/keywords`, updatedKeywords);
        console.log('Keywords sent to remote server successfully');

        res.json({ message: 'Keywords updated successfully' });
    } catch (error) {
        console.error('Error updating keywords:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// New API route to remove keywords
app.post('/api/removeKeyword', async (req, res) => {
    try {
        const { keyword } = req.body;
        if (!keyword) {
            console.error('No keyword provided');
            return res.status(400).json({ error: 'Keyword is required' });
        }

        console.log(`Removing keyword: ${keyword}`);

        let existingKeywords = await readJsonFile(KEYWORDS_FILE) || [];
        if (!Array.isArray(existingKeywords)) {
            console.warn('Existing keywords data is not an array. Initializing to an empty array.');
            existingKeywords = [];
        }

        const updatedKeywords = existingKeywords.filter(kw => kw !== keyword);

        await writeJsonFile(KEYWORDS_FILE, updatedKeywords);
        console.log('Keyword removed successfully');

        // Send updated keywords to the remote server
        await axios.post(`${REMOTE_SERVER_URL}/api/removeKeyword`, { keyword });
        console.log('Keyword removal sent to remote server successfully');

        res.json({ message: 'Keyword removed successfully' });
    } catch (error) {
        console.error('Error removing keyword:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API to get existing keywords from keywords.json
app.get('/display/keywords', async (req, res) => {
    try {
        console.log('Fetching existing keywords from keywords.json...');
        const existingKeywords = await readJsonFile(KEYWORDS_FILE);
        res.json(existingKeywords || []); // Return an empty array if no keywords found
    } catch (error) {
        console.error('Error fetching keywords from keywords.json:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


async function readJsonFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        log(`Error reading JSON file: ${error.message}`);
        return null;
    }
}

async function writeJsonFile(filePath, data) {
    try {
        const content = JSON.stringify(data, null, 2);
        await fs.writeFile(filePath, content);
    } catch (error) {
        log(`Error writing JSON file: ${error.message}`);
    }
}

app.get('/keywords', (req, res) => {
    res.sendFile(path.join(publicDir, 'keywords.html'));
});

app.get('/api/backup-channels', async (req, res) => {
    try {
        log('Fetching backup channels');
        
        // Debugging: Log the backup directory path
        console.log('Backup directory path:', backupDir);

        // Debugging: Log all directories in the backup folder
        const directories = await fs.readdir(backupDir);
        console.log('Backup directories:', directories);

        const files = await fs.readdir(backupDir, { withFileTypes: true });
        const channels = await Promise.all(files
            .filter(dirent => dirent.isDirectory())
            .map(async dirent => {
                const channelPath = path.join(backupDir, dirent.name);
                const originalVideosPath = path.join(channelPath, 'original_videos');
                const originalVideos = await fs.readdir(originalVideosPath);
                const videos = originalVideos
                    .filter(file => file.endsWith('.mp4'))
                    .sort()
                    .map(file => {
                        const baseName = path.basename(file, '.mp4');
                        return {
                            video: file,
                            audio: `${baseName}.mp3`,
                            captions: `${baseName}.vtt`
                        };
                    });
                return {
                    name: dirent.name,
                    videos
                };
            }));
        log(`Found ${channels.length} backup channels`);
        res.json(channels);
    } catch (err) {
        log(`Error reading backup channels: ${err.message}`);
        res.status(500).json({ error: 'Failed to read backup directory', details: err.message });
    }
});




app.post('/api/merge-videos', async (req, res) => {
    const { channel, videos } = req.body;
    
    if (!channel || !videos || videos.length === 0) {
        return res.status(400).json({ error: 'Invalid request data' });
    }

    try {
        const videoPaths = videos.map(video => path.join(backupDir, channel, 'original_videos', video));
        
        // Ensure all videos exist
        for (const videoPath of videoPaths) {
            if (!(await fileExists(videoPath))) {
                console.log(`Video file not found: ${videoPath}`); // Log the missing file
                return res.status(404).json({ error: `Video file not found: ${videoPath}` });
            }
        }

        console.log('Video files found:', videoPaths); // Log all video paths

        // Create a text file with all the videos to be merged
        const fileListPath = path.join(__dirname, 'temp', `merge_${channel}.txt`);
        
        // Use forward slashes and ensure paths are quoted for ffmpeg
        const fileListContent = videoPaths
            .map(v => `file '${v.replace(/\\/g, '/')}'`)  // Replace backslashes with forward slashes
            .join('\n');
            
        await fs.writeFile(fileListPath, fileListContent);

        console.log('File list created for merging at:', fileListPath);

        // Output path for the merged video
        const outputVideoPath = path.join(__dirname, 'temp', `merged_${channel}_${Date.now()}.mp4`);

        // Merge the videos using ffmpeg
        const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath.replace(/\\/g, '/')}" -c copy "${outputVideoPath.replace(/\\/g, '/')}"`;
        console.log('Running ffmpeg command:', ffmpegCommand); // Log the ffmpeg command

        const { stdout, stderr } = await execPromise(ffmpegCommand);
        console.log('ffmpeg output:', stdout); // Log ffmpeg stdout
        if (stderr) console.error('ffmpeg stderr:', stderr); // Log ffmpeg stderr

        console.log('Merged video created at:', outputVideoPath); // Log the output path

        // Send the merged video URL back to the client
        res.json({ mergedVideoUrl: `/temp/${path.basename(outputVideoPath)}` });

        // Trigger garbage collection after merging videos
        if (global.gc) {
            global.gc();
        } else {
            console.warn('Garbage collection unavailable. Run Node with --expose-gc');
        }

    } catch (error) {
        console.error('Error merging videos:', error);
        res.status(500).json({ error: 'Failed to merge videos', details: error.message });
    }
});



app.use('/temp', express.static(path.join(__dirname, 'temp')));



// Add this route to serve the new backup playback page
app.get('/backup-playback', (req, res) => {
    res.sendFile(path.join(publicDir, 'backup.html'));
});
  
    
