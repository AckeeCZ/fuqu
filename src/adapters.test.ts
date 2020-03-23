import { PubSub } from '@google-cloud/pubsub';
import { createPubsubAdapter } from './queue/pubsub';
import { Event, FuQuOptions, FuQu } from './fuqu';
import { connect } from 'amqplib';
import { createRabbitAdapter } from './queue/rabbit';

const uniq = <T>(xs: T[]) => Array.from(new Set(xs));

const adapters: {
    name: string;
    beforeAll: () => void | Promise<void>;
    createFuQu: <P extends object, A extends Record<string, string>>(
        topicName: string,
        options?: FuQuOptions
    ) => Promise<FuQu<P, A, any>>;
}[] = [
    {
        name: 'Pub/Sub',
        beforeAll: () => {
            process.env.PUBSUB_EMULATOR_HOST = 'localhost:8681';
            process.env.PUBSUB_PROJECT_ID = 'fuqu';
        },
        createFuQu: async (topicName: string, options?: FuQuOptions) =>
            createPubsubAdapter(new PubSub(), topicName, options),
    },
    {
        name: 'Rabbit MQ',
        beforeAll: async () => {},
        createFuQu: async (topicName: string, options?: FuQuOptions) =>
            createRabbitAdapter(await connect('amqp://localhost'), topicName, options),
    },
];
for (let adapter of adapters) {
    describe(adapter.name, () => {
        describe('Emulator', () => {
            beforeAll(adapter.beforeAll);
            test('Publishes message and receives it in handler', async () => {
                const msg = { foo: new Date().getTime() };
                const fuq = await adapter.createFuQu<{ foo: number }, any>('fuqu1');
                await new Promise(async resolve => {
                    await fuq.subscribe(x => {
                        expect(x).toStrictEqual(msg);
                        return resolve();
                    });
                    await fuq.publish(msg);
                });
                await fuq.close();
            });
            test('Is alive after initialization, is not on close', async () => {
                const fuq = await adapter.createFuQu('fuqu2');
                await fuq.subscribe(() => {});
                expect(await fuq.isAlive()).toBe(true);
                await fuq.close();
                expect(await fuq.isAlive()).toBe(false);
            });
            describe('Logs events', () => {
                const message = { hello: 'world' };
                const attributes = { version: '1' };
                const events: Event<any, any>[] = [];
                beforeAll(async () => {
                    const fuq = await adapter.createFuQu('fuqu3', { eventLogger: e => events.push(e) });
                    await new Promise(async resolve => {
                        await fuq.subscribe(resolve);
                        fuq.publish(message, attributes);
                    });
                    await fuq.isAlive();
                    await fuq.close();
                });
                test('Triggered expected events', () => {
                    const expectedEvents: Event<any, any>['action'][] = [
                        'create',
                        'subscribe',
                        'publish',
                        'receive',
                        'ack',
                        'hc',
                        'close',
                    ];
                    expect(events).toHaveLength(expectedEvents.length);
                    expect(events.map(e => e.action)).toStrictEqual(expectedEvents);
                });
                test('All have correct topicName', () => {
                    expect(events.every(e => e.topicName === 'fuqu3')).toBe(true);
                });
                test('Create has options', () => {
                    const create = events.find(e => e.action === 'create');
                    expect(create).toHaveProperty(['options', 'eventLogger']);
                });
                test('Payload, attributes, times match', () => {
                    const publish = events.find(e => e.action === 'publish')!;
                    const receive = events.find(e => e.action === 'receive')!;
                    const ack = events.find(e => e.action === 'ack')!;
                    // payloads and attributes match
                    [publish, receive, ack].forEach((e: any) => expect(e.payload).toStrictEqual(message));
                    [publish, receive, ack].forEach((e: any) => expect(e.attributes).toStrictEqual(attributes));
                    // times match
                    expect(uniq([receive, ack].map((e: any) => e.published))).toHaveLength(1);
                    expect(uniq([receive, ack].map((e: any) => e.received))).toHaveLength(1);
                });
                test.todo('Published < Received < Finished');
                test.todo('Finished in > 0');
                test.todo('Processed in > 0');
                test.todo('Types match');
            });
        });
    });
}
