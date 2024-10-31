import {test} from "brittle";
import { PassThrough, Writable } from 'streamx';
import createStreamSwitcher from './index.js';

test('test pump duplex behavior', async (t) => {
    // Plan assertions
    t.plan(3);

    // Create two streams to use as active streams in the pump
    const initialStream = new PassThrough();
    const newStream = new PassThrough();

    // Initialize the pump without an initial stream
    const pump = createStreamSwitcher();

    // Collect data from the output for reading verification
    const outputData = [];
    pump.on('data', (chunk) => outputData.push(chunk.toString()));

    // Set up listeners on initialStream to verify writing from output
    const initialStreamData = [];
    initialStream.on('data', (chunk) => initialStreamData.push(chunk.toString()));

    // Add initial stream via switch and test reading
    pump.switch(initialStream);
    initialStream.write('data from initialStream');
    await new Promise((resolve) => setTimeout(resolve, 0)); // Wait a tick for data to flow

    // Verify initial data flows into output
    t.is(outputData[0], 'data from initialStream', 'Output should reflect data from initialStream');

    // Test writing to output and verify it reaches initialStream
    pump.write('written to initialStream');
    await new Promise((resolve) => setTimeout(resolve, 0)); // Wait a tick for data to flow

    // Verify initialStream received both its own write and the write from output
    t.alike(
        initialStreamData,
        ['data from initialStream', 'written to initialStream'],
        'Initial stream should receive its own data and data written to output'
    );

    // Swap to newStream and verify it receives written data
    const newStreamData = [];
    newStream.on('data', (chunk) => newStreamData.push(chunk.toString()));

    pump.switch(newStream);
    pump.write('written to newStream');
    await Writable.drained(pump);
    await new Promise((resolve) => setTimeout(resolve, 100));

    t.alike(
        newStreamData,
        ['written to newStream'],
        'New stream should receive data written to output after swap'
    );
});
