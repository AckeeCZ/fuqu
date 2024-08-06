<div align="center">

<img src="./resources/logo.png" height="170"/>

# FuQu _[/fʌkjuː/](https://en.wikipedia.org/wiki/Help:IPA/English)_

Rude, powerful Pub/Sub wrapper that handles logging, reconnecting and much more

[![Known Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/AckeeCZ/fuqu.svg?style=flat-square)](https://snyk.io/test/github/AckeeCZ/fuqu)
[![Npm](https://img.shields.io/npm/v/fuqu.svg?style=flat-square)](https://www.npmjs.com/package/fuqu)
[![License](https://img.shields.io/github/license/AckeeCZ/fuqu.svg?style=flat-square)](https://github.com/AckeeCZ/fuqu/blob/master/LICENSE)

</div>

- 💓 Automatic reconnecting
- 📨 Extensive predictable logging
- 💙 Typesafe
- ☔ Covered with integration tests
- 🔑 Use only essential permissions
- 🚦 Explicit message acknowledgement

## Getting started

```bash
npm install fuqu
```

```typescript
import { PubSub } from '@google-cloud/pubsub'
import { FuQu } from 'fuqu'

const fuqu = FuQu(() => new PubSub())

fuqu.createPublisher('my-topic').publish({ json: { hello: 'kitty' } })
fuqu.createSubscriber('my-subscription', message => {
  console.log('got it!')
  message.ack()
})
```

## Options

```typescript
const fuQu = FuQu(() => new PubSub(), {
    // Log by hooking on various events
    logger: {
        nackMessage: (subscriptionName, message) => {
            console.log(`Message ${message.id} from ${subscriptionName} NACKed`)
        },
        // ...
    },
    // Reinitialize subscribers when "dry" (waiting) for 30 seconds
    reconnectAfterMillis: 30 * 1e3
    // When working exclusively with JSON data, recieve them parsed in logger events and handlers
    parseJson: true
    // Other Pub/Sub subscriber options
    batching: { maxMessages: 5 }
});
// override options for subscriber
const noReconnectingSubscriber = fuQu.createSubscriber('sub', m => m.ack(), { reconnectAfterMillis: 0 })
```

## Features

### Reconnecting (`reconnectAfterMillis`)

After few years of using Pub/Sub, we noticed that sometimes the existing subscriber "stops" receiving messages, even though they start piling up and there are no other consumers or no pending messages. Restarting process always helps. After failing to implement a reliable health check to automatically restart the pod, we implemented a more gentle solution and implement reconnecting after a given timeout ourselves.

1. If there are no messages being processed by the subscriber (all received messages are `ack`-ed or `nack`-ed)
2. And time elapsed from last processed message in milliseconds is greater than `reconnectAfterMillis`
3. Then clear all listeners, reinitialize the `PubSub` instance, reapply registered handlers

### Logger

Implement your own logger to log events in the format you need:

- `initializedPublisher`
- `publishedMessage`
- `initializedSubscriber`
- `subscriberReconnected`
- `receivedMessage`
- `ackMessage`
- `nackMessage`
- `error`

> ⚠️ **Massive logs, confidential data alert** Be mindful, that some hooks (e.g. `ackMessage`) are provided the original Pub/Sub message. When it is logged directly, it can result in extremely large output (JSON representation of `Buffer`) and credential info (link to initialized Pub/Sub subscriber). Only log explicit fields to avoid these issues. See the snippet.

```ts
// BAD
const dangerousCarelessLogger = {
  ackMessage: (subscriptionName, message) =>
    logger.info({ message, subscriptionName }, 'acked message'),
}

// GOOD
const politePersonLogger = {
  ackMessage: (subscriptionName, message) =>
    logger.info(
      {
        subscriptionName,
        id: message.id,
        length: message.length,
        entityId: message.jsonData.entityId,
      },
      'acked message'
    ),
}
```

### Error handling

The original Pub/Sub subscriber is an event emitter, that can emit errors we need to handle to avoid unhandled rejected promises and unhandled errors, see [original error handling](https://github.com/googleapis/nodejs-pubsub/blob/main/samples/listenForErrors.js).

Usually the errors are not even bound to a certain message (rather a batch or the connection in general), making the errors hard to react to logically, but practical to monitor. That's why it is included in the logger event.

> ⚠️ **Failing to provide a handler will result in error being re-thrown in the error handler.**

### JSON parsing

When you are working with JSON messages, it might be convenient to access the structured JSON in logger events and handler. To avoid repeated parsing from buffer, use option `parseJson`. This will make FuQu parse the JSON for you and the output is available in `message.jsonData`.

When the option is disabled or parsing fails, the field will contain empty object `{}`.

#### Reason `nack`

Since `nack` often means that processing failed due to an error occurrence, having the ability to send the `nack` reason proves convenient for logging.

FuQu already needs to patch both `ack` and `nack` functions to implement tracking of processed messages for reconnecting. That is why we decided to alter `nack` function to include a reason. It is a required argument, but you can pass in `null` (usually, you would supply an error, message etc.). This reason now pops up as an argument in your logger.

### Rude mode

If you want to have optimal FuQu experience, use imports from `fuqu/dist/real`.

## Testing

For running tests, start the following containers 🐳

```
docker-compose up --build
```

## License

This project is licensed under [MIT](./LICENSE).
