# Fuqu

Fuqu is tiny package for node backend development which is used for manipulating with queues.

## Install

```bash
npm i --save fuqu
```

## Usage

```typescript
import { Fuqu, FuquType } from 'fuqu';

// to google pubsub you need to send buffer
const data = Buffer.from(JSON.stringify({
    message: 'Hello world!',
    messageId: 1,
}));

const fuq = new Fuqu(FuquType.googlePubSub, { // FuquType.custom 
    keyFilename: ...,
    projectId: ...,
    topicName: ...,
 });
fuq.off(message => { // register callback
    const myDataObject = JSON.parse(message.data);
    // do something
});

...

return fuq.in(data) // Promise<any>
    .then(() => {
        console.log(`Successfully pushed to queue!`)
    });
```
## License

This project is licensed under [MIT](./LICENSE).
