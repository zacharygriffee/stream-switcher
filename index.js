import {Duplex} from 'streamx';

function createStreamSwitcher(initialStream, config = {}) {
    const output = new Duplex({
        ...config,
        read(callback) {
            callback(); // Signal that reading can continue
        },
        write(chunk, callback) {
            if (output.activeStream) {
                output.activeStream.write(chunk); // Forward writes to the active stream
            }
            callback();
        }
    });

    let listeners = [];
    output.activeStream = initialStream;
    // Helper function to connect a stream to the output
    const connectStream = (stream) => {
        const onData = (chunk) => {
            if (stream === output.activeStream) output.push(chunk); // Ensure only active stream pushes data
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

    // Connect the initial stream if provided
    if (output.activeStream) connectStream(output.activeStream);

    // Function to swap streams safely without affecting the previous one
    // Return the pump API
    output.switch = (newStream) => {
        // Remove listeners from the current active stream
        if (output.activeStream) {
            output.activeStream.off('data', listeners[0]);
            output.activeStream.off('end', listeners[1]);
            output.activeStream.off('error', listeners[2]);
        }

        // Update activeStream and connect the new stream to output
        output.activeStream = newStream;
        connectStream(output.activeStream);
    };
    return output;
}

export {createStreamSwitcher};
export default createStreamSwitcher;
