const { getVideoInfo, createAudioStream } = require('./utils/youtube');
const fs = require('fs');
const path = require('path');

const TEST_URL = 'https://youtu.be/G8nlhcmDXNE?si=ggLCxxGKECImX8KO';

async function runTest() {
    console.log('🚀 Starting Manual Test for URL:', TEST_URL);

    // 1. Test Metadata Extraction
    console.log('\n--- Testing getVideoInfo ---');
    try {
        const info = await getVideoInfo(TEST_URL);
        console.log('✅ Metadata retrieved:', JSON.stringify(info, null, 2));
    } catch (error) {
        console.error('❌ getVideoInfo failed:', error.message);
        fs.writeFileSync('error_video_info.log', JSON.stringify({ message: error.message, stack: error.stack, ...error }, null, 2));
    }

    // 2. Test Download Stream
    console.log('\n--- Testing createAudioStream ---');
    const outputPath = path.join(__dirname, 'test_download.mp3');
    const fileStream = fs.createWriteStream(outputPath);

    try {
        const result = await createAudioStream(TEST_URL, (progress, message) => {
            console.log(`[Download Progress] ${progress}% - ${message}`);
        });

        const stream = result.stream;
        console.log(`✅ Stream created using method: ${result.method}`);

        stream.pipe(fileStream);

        await new Promise((resolve, reject) => {
            stream.on('end', () => {
                console.log('✅ Stream ended');
                // Don't resolve yet, wait for file write to finish
            });
            stream.on('error', (err) => {
                console.error('❌ Stream error:', err);
                reject(err);
            });
            fileStream.on('finish', () => {
                console.log('✅ File write finished');
                resolve();
            });
            fileStream.on('error', (err) => {
                console.error('❌ File write error:', err);
                reject(err);
            });
        });

        console.log('🎉 Download test completed successfully. File saved to:', outputPath);

        // Clean up
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            console.log(`📦 Final file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            // fs.unlinkSync(outputPath); // Keep it for inspection if needed, or uncomment to clean
            console.log('🧹 (Test file kept for inspection)');
        }

    } catch (error) {
        console.error('❌ createAudioStream test failed:', error.message);
        fs.writeFileSync('error_stream.log', JSON.stringify({ message: error.message, stack: error.stack, ...error }, null, 2));
    }
}

runTest();
