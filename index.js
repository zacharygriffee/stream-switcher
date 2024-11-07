import { Duplex } from 'streamx';

/**
 * Creates a duplex stream that can switch between different active streams and buffer data when paused.
 *
 * @param {Duplex|null} initialStream - The initial stream to connect to the output, or null to start paused.
 * @param {Object} [config={}] - Configuration options.
 * @param {boolean} [config.bufferWhenPaused=false] - Whether to buffer data when the output is paused.
 * @param {number} [config.maxBufferSize=100] - The maximum number of items to buffer when paused.
 * @returns {Duplex} A duplex stream that can switch between different active streams.
 */
function createStreamSwitcher(initialStream, config = {}) {
    const { bufferWhenPaused = false, maxBufferSize = 100 } = config; // Added maxBufferSize configuration
    const buffer = [];
    const output = new Duplex({
        ...config,
        read(callback) {
            callback(); // Signal that reading can continue
        },
        write(chunk, callback) {
            if (output.activeStream) {
                // If there is an active stream, process the buffer first in order
                if (buffer.length > 0) {
                    while (buffer.length > 0) {
                        output.activeStream.write(buffer.shift());
                    }
                }
                output.activeStream.write(chunk); // Forward writes to the active stream
            } else if (bufferWhenPaused) {
                if (buffer.length < maxBufferSize) {
                    buffer.push(chunk); // Buffer data if paused and option is set, within watermark limit
                } else {
                    output.emit('error', new Error('Buffer size limit exceeded')); // Emit error if buffer is full
                }
            }
            callback();
        }
    });

    let listeners = [];
    let isPaused = !initialStream;

    output.activeStream = initialStream;

    const connectStream = (stream) => {
        const onData = (chunk) => {
            if (stream === output.activeStream) {
                if (isPaused) {
                    isPaused = false;
                    output.resume();
                }
                output.push(chunk); // Ensure only active stream pushes data
            }
        };
        const onEnd = () => {
            if (stream === output.activeStream) output.push(null); // Signal end only if it's the active stream
        };
        const onError = (err) => {
            if (stream === output.activeStream) output.emit('error', err); // Emit error without closing output
        };

        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);

        // Store listeners for cleanup during swap
        listeners = [onData, onEnd, onError];
    };

    if (output.activeStream) connectStream(output.activeStream);

    output.switch = (newStream) => {
        if (output.activeStream) {
            output.activeStream.off('data', listeners[0]);
            output.activeStream.off('end', listeners[1]);
            output.activeStream.off('error', listeners[2]);
        }

        output.activeStream = newStream;

        if (output.activeStream) {
            connectStream(output.activeStream);
            if (isPaused) {
                isPaused = false;
                output.resume();
            }
            if (bufferWhenPaused && buffer.length > 0) {
                // Ensure buffered data is written in the correct order
                buffer.splice(0).forEach((chunk) => output.activeStream.write(chunk));
            }
        } else {
            isPaused = true;
            output.pause();
        }
    };

    return output;
}

export { createStreamSwitcher };
export default createStreamSwitcher;
