# Deprecation Notice

## Status: Deprecated ⚠️

This package is now deprecated and will no longer receive updates. We recommend migrating to official solutions for your pub/sub and messaging needs.

### Why are we deprecating?

After careful consideration, we've decided to deprecate `fuqu` because:

1. Modern official pub/sub libraries and messaging solutions now provide excellent native functionality
2. Maintaining an abstraction layer over these services adds unnecessary complexity to codebases
3. Direct usage of official SDKs offers better type safety, up-to-date features, and comprehensive documentation

### Recommended Alternatives

We recommend migrating to official solutions based on your specific needs:

- Google Cloud Pub/Sub: [Official Client Libraries](https://cloud.google.com/pubsub/docs/reference/libraries)
- AWS SNS/SQS: [AWS SDK](https://aws.amazon.com/sdk-for-javascript/)
- Azure Service Bus: [Azure SDK](https://learn.microsoft.com/en-us/javascript/api/overview/azure/service-bus)

### Thank You

We want to thank all contributors and users who have supported this package. While `fuqu` served its purpose during its active period, we believe pointing users toward official solutions will provide a better developer experience in the long run.

### Support

This repository will remain available for reference, but we encourage all users to migrate to the recommended alternatives. No new features or bug fixes will be implemented.

---

<div align="center">


<img src="./resources/logo.png" height="170"/>


# FuQu _[/fʌkjuː/](https://en.wikipedia.org/wiki/Help:IPA/English)_

Rude MQ wrapper that handles logging and message acknowlidgement for you

[![Build Status](https://img.shields.io/travis/AckeeCZ/fuqu.svg?style=flat-square)](https://travis-ci.org/AckeeCZ/fuqu)
[![Known Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/AckeeCZ/fuqu.svg?style=flat-square)](https://snyk.io/test/github/AckeeCZ/fuqu)
[![Coverage](https://img.shields.io/coveralls/github/AckeeCZ/fuqu?style=flat-square)](https://coveralls.io/github/AckeeCZ/fuqu)
[![Npm](https://img.shields.io/npm/v/fuqu.svg?style=flat-square)](https://www.npmjs.com/package/fuqu)
[![License](https://img.shields.io/github/license/AckeeCZ/fuqu.svg?style=flat-square)](https://github.com/AckeeCZ/fuqu/blob/master/LICENSE)


</div>

- 📨 Extensive predictable logging
- ☔ Covered with integration tests
- 🐇 Supports Google Pub/Sub and RabbitMQ
- 🤡 Mock implementation for your tests
- 💙 Typesafe message and attributes
- 🚦 Automatic message acknowlidgement
- 💓 Check heartbeat if connection is alive
- ⛔ Configurable consumer flow control
- 🐛 Debuggable with `DEBUG:*`

## Getting started

```bash
npm install fuqu
```

```typescript
// Create instance
const fuQu = fuQuRabbit<{ hello: string }>(connection, 'my-queue');
// Subscribe handler
fuQu.subscribe(msg => {
    console.log('Got this:', msg);
});
// Publish message
fuQu.publish({ hello: 'FuQu!' });
```

- Handler may be async
- Messages are automatically acknowledged. If there is an error, they are `nack`ed instead.

### Create instance
```typescript
import { connect } from 'amqplib';
import { PubSub } from '@google-cloud/pubsub';
import { fuQuPubSub, fuQuRabbit } from 'fuqu';

// RabbitMQ
const connection = await connect('amqp://localhost');
const fuQu1 = fuQuRabbit(connection, 'my-queue');

// Pub/Sub
const pubSub = new PubSub({/*...*/})
const fuQu1 = fuQuPubSub(pubSub, 'my-queue');
```

### Options
```typescript
const fuQu = fuQuRabbit(connection, 'my-queue', {
    // Throttle your consumers
    maxMessages: 1,
    // Log all events (typesafe, check for shapes!)
    eventLogger: event => {
        if (event.action !== 'hc') {
            console.log(`FuQu [${event.topicName}] (${event.action})`, event)
        }
    },
    // Mock with in-memory mock for your tests
    useMock: process.env.NODE_ENV === 'test',
    // Adapter specific options
    assertQueueOptions: {/* ... */}
});
```
 - Mock implements all general FuQu options. Accessing underlying message is unsafe and adapter specific options are ignored
 - `eventLogger` is for application logging, if no handler is passed, logging is disabled
 - For debug purposes, you can also enable logging via `DEBUG:*`, `DEBUG:fuqu:*` or `DEBUG:fuqu:my-topic:*`
 - `maxMessages` is transformed into specific options for each adapter, using custom adapter options might overwrite the behavior

### Rude mode
If you want to have optimal FuQu expirience, use imports from `fuqu/dist/real`.

## Testing

For running tests, start the following containers 🐳

```
docker-compose up --build
```

## License

This project is licensed under [MIT](./LICENSE).
