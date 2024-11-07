import {test} from "brittle";
import {PassThrough, Readable, Writable} from 'streamx';
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


test('test pump pause and resume behavior', async (t) => {
    // Plan assertions
    t.plan(4);

    // Initialize the pump without an initial stream
    const pump = createStreamSwitcher();

    // Ensure the pump starts paused
    t.is(Readable.isPaused(pump), true, 'Pump should start in a paused state when no active stream is set');

    // Write data and verify it does not process while paused
    const outputData = [];
    pump.on('data', (chunk) => outputData.push(chunk.toString()));

    pump.write('data while paused');
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.is(outputData.length, 0, 'No data should be processed when pump is paused');

    // Create and set an active stream
    const activeStream = new PassThrough();
    activeStream.write('resumed data');
    pump.switch(activeStream);
    await new Promise((resolve) => setTimeout(resolve, 0)); // Wait a tick for data to flow

    // Verify data flows when activeStream is set
    t.is(outputData[0], 'resumed data', 'Output should reflect data when activeStream is set');

    // Test writing after stream is set
    pump.write('additional data');
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.is(outputData[1], 'additional data', 'Output should reflect additional data written after resumption');
});

// Test for buffering when paused with watermark
test('test buffer when paused with watermark', async (t) => {
    // Plan assertions
    t.plan(4);

    // Initialize the pump with buffering enabled and a low watermark
    const pump = createStreamSwitcher(null, { bufferWhenPaused: true, maxBufferSize: 2 });

    // Write data and check if it buffers correctly
    pump.write('buffered data 1');
    pump.write('buffered data 2');

    t.is(Readable.isPaused(pump), true, 'Pump should be paused when no active stream is set');

    // Exceed the buffer watermark
    let errorCaught = false;
    pump.on('error', (err) => {
        errorCaught = true;
        t.is(err.message, 'Buffer size limit exceeded', 'Should emit an error when buffer exceeds watermark');
    });

    pump.write('buffered data 3');
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.ok(errorCaught, 'Error should be caught when buffer exceeds watermark');

    // Add active stream and verify data is flushed
    const activeStream = new PassThrough();
    const activeStreamData = [];
    activeStream.on('data', (chunk) => activeStreamData.push(chunk.toString()));

    pump.switch(activeStream);
    await new Promise((resolve) => setTimeout(resolve, 0)); // Wait a tick for data to flow

    t.alike(
        activeStreamData,
        ['buffered data 1', 'buffered data 2'],
        'Buffered data should be written to active stream after resumption'
    );
});

// Test for resumption after pausing
test('test pump resumption after pausing', async (t) => {
    // Plan assertions
    t.plan(4);

// Initialize the pump without an initial stream but with buffering enabled
    const pump = createStreamSwitcher(null, { bufferWhenPaused: true });

// Write data while paused
    pump.write('data while paused');
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.is(Readable.isPaused(pump), true, 'Pump should remain paused with no active stream');

// Collect data from output to ensure it processes after resumption
    const outputData = [];
    pump.on('data', (chunk) => outputData.push(chunk.toString()));

// Add active stream and ensure it resumes
    const activeStream = new PassThrough();
    pump.switch(activeStream);
    await new Promise((resolve) => setTimeout(resolve, 0)); // Wait a tick for buffered data to flush

    t.is(outputData[0], 'data while paused', 'Output should reflect buffered data before new data after resumption');

// Write additional data and ensure it is processed
    activeStream.write('resumed data');
    pump.write('additional data');
    await new Promise((resolve) => setTimeout(resolve, 0));

    t.is(outputData[1], 'resumed data', 'Output should reflect data from active stream');
    t.is(outputData[2], 'additional data', 'Output should reflect additional data written after resumption');

});