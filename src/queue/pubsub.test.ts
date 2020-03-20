import { PubSub } from '@google-cloud/pubsub';
import { createPubsubAdapter } from './pubsub';

describe('PubSub', () => {
    describe('Emulator', () => {
        beforeAll(() => {
            process.env.PUBSUB_EMULATOR_HOST = 'localhost:8681';
        })
        test('Creates topic, subscription, publishes message, receives message, closes', async () => {
            const pubSub = new PubSub();
            const msg = { foo: 2 };
            const fuq = createPubsubAdapter(pubSub, 'foo');
            await new Promise(async resolve => {
                await fuq.subscribe(x => {
                    expect(x).toStrictEqual(msg)
                    return resolve();
                });
                fuq.publish(msg)
            });
            return fuq.close();
        });
    })
});
