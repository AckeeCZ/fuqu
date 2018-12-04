# Fuqu

Fuqu is tiny package for node backend development which is used for manipulating with queues.

## Install

```bash
npm i --save fuqu
```

## Usage

```typescript
import { Fuqu, FuquType } from 'fuqu';

const data = {
    message: 'Hello world!',
    messageId: 1,
};

const fuq = new Fuqu(FuquType.googlePubSub, { // FuquType.custom 
    keyFilename: ...,
    projectId: ...,
    topicName: ...,
 });
fuq.off(message => { // register callback
    const notificationObject = JSON.parse(message.data); // you need to parse JSON
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
