# `stream-switcher`

`stream-switcher` is a utility function that provides a flexible mechanism to dynamically switch between active streams while maintaining seamless data flow. It allows you to designate one active stream at a time, forwarding data and handling connections without interference from previously connected streams.

## Usage

### Importing `stream-switcher`

```javascript
import { createStreamSwitcher } from 'stream-switcher';
```

### Basic Example

Initialize `createStreamSwitcher` with an initial stream, allowing data to flow through it:

```javascript
import { PassThrough } from 'streamx';
import { createStreamSwitcher } from 'stream-switcher';

const initialStream = new PassThrough();
const switcher = createStreamSwitcher(initialStream);

// Capture data from the active stream
switcher.on('data', (chunk) => {
    console.log('Received:', chunk.toString());
});

// Write data to the initial stream
initialStream.write('Hello from the initial stream!');
```

### Switching to a New Stream

Use the `switch` method to replace the active stream with a new one, seamlessly transferring data flow to the new stream:

```javascript
const newStream = new PassThrough();
switcher.switch(newStream);

newStream.write('Hello from the new stream!');
```

### Writing to the Active Stream

The `switcher` can also function as a writable stream, where data sent to `switcher.write()` will be forwarded to the current active stream:

```javascript
switcher.write('Forwarded to active stream');
```

## Features

- **Dynamic Stream Switching**: Easily swap active streams without disrupting data flow from previous connections.
- **Bi-directional Data Forwarding**: `switcher` relays data to and from the active stream seamlessly.
- **Automatic Listener Management**: Only the active stream pushes data to `switcher`, ensuring data consistency and efficient resource management.

## API

### `createStreamSwitcher(initialStream, config)`

Creates a new `Duplex` instance output stream that facilitates stream switching.

- **`initialStream`** (optional): The first stream to connect to the switcher.
- **`config`** (optional): The configuration supplied to output stream.

#### `switcher.switch(newStream)`

Changes the active stream to the provided `newStream`.

- **`newStream`**: The new stream that becomes the active stream for `switcher`.

## License

MIT License. See LICENSE file for full details.

For questions, issues, or contributions, feel free to reach out or create a pull request!