<div align="center">


[![Build Status](https://travis-ci.org/AckeeCZ/fuqu.svg?branch=master)](https://travis-ci.org/AckeeCZ/fuqu)
[![Npm](https://img.shields.io/npm/v/fuqu.svg?style=flat-square)](https://www.npmjs.com/package/fuqu)
[![License](https://img.shields.io/github/license/AckeeCZ/fuqu.svg?style=flat-square)](https://github.com/AckeeCZ/fuqu/blob/master/LICENSE)

<img src="./resources/logo.png" height="170"/>
</div>

# Fuqu

Fuqu is tiny package for node backend development which is used for manipulating with queues.

GitHub repository: [https://github.com/AckeeCZ/fuqu](https://github.com/AckeeCZ/fuqu)

## Install

```bash
npm i --save fuqu
```

## Supports

- Google PubSub
- Your custom solution which implements `FuquOperations`

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
    const myDataObject = message.data; // FuquMessage
    // do something
});

...

return fuq.in({ data }) // Promise<any>
    .then(() => {
        console.log(`Successfully pushed to queue!`)
    });
```
## License

This project is licensed under [MIT](./LICENSE).
