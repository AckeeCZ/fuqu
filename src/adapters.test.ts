import { PubSub } from '@google-cloud/pubsub';
import { createPubsubAdapter } from './queue/pubsub';
import { Event, FuQuOptions, FuQu, FinishedMessageMetadata, IncomingMessageMetadata } from './fuqu';
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
                const fuq = await adapter.createFuQu<{ foo: number }, any>('fuqu-ack');
                await new Promise(async resolve => {
                    await fuq.subscribe(x => {
                        expect(x).toStrictEqual(msg);
                        return resolve();
                    });
                    await fuq.publish(msg);
                });
                await fuq.close();
            });
            test('Nack message comes back', async () => {
                const msg = { foo: new Date().getTime() };
                const fuq = await adapter.createFuQu<{ foo: number }, any>('fuqu-nack');
                const handler = jest.fn();
                await new Promise(async resolve => {
                    handler.mockRejectedValueOnce(new Error()).mockImplementationOnce(resolve);
                    await fuq.subscribe(handler);
                    await fuq.publish(msg);
                });
                await fuq.close();
                expect(handler).toBeCalledTimes(2);
            });
            test('Is alive after initialization, is not on close', async () => {
                const fuq = await adapter.createFuQu('fuqu-alive');
                await fuq.subscribe(() => {});
                expect(await fuq.isAlive()).toBe(true);
                await fuq.close();
                expect(await fuq.isAlive()).toBe(false);
            });
            test('Faster timeout on isAlive wins (dangerous test)', async () => {
                const fuq = await adapter.createFuQu('fuqu-timeout');
                // expect health check to take more than 0 ms
                expect(await fuq.isAlive(0)).toBe(false);
                await fuq.close().catch();
            });
            describe('Logs events', () => {
                const message = { hello: 'world' };
                const attributes = { version: '1' };
                const events: Event<any, any>[] = [];
                beforeAll(async () => {
                    const fuq = await adapter.createFuQu('fuqu-events', { eventLogger: e => events.push(e) });
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
                    expect(events.every(e => e.topicName === 'fuqu-events')).toBe(true);
                });
                test('Create has options', () => {
                    const create = events.find(e => e.action === 'create');
                    expect(create).toHaveProperty(['options', 'eventLogger']);
                });
                test('Payload, attributes, times match', () => {
                    const publish = events.find(e => e.action === 'publish')! as IncomingMessageMetadata<any, any>;
                    const receive = events.find(e => e.action === 'receive')! as FinishedMessageMetadata<any, any>;
                    const ack = events.find(e => e.action === 'ack')! as FinishedMessageMetadata<any, any>;
                    // payloads and attributes match
                    [publish, receive, ack].forEach(e => expect(e.payload).toStrictEqual(message));
                    [publish, receive, ack].forEach(e => expect(e.attributes).toStrictEqual(attributes));
                    // times match
                    expect(uniq([receive, ack].map(e => e.publishTime))).toHaveLength(1);
                    expect(uniq([receive, ack].map(e => e.receiveTime))).toHaveLength(1);
                });
                test('Times align: publishTime < receiveTime < finishTime', () => {
                    const ack = events.find(e => e.action === 'ack')! as FinishedMessageMetadata<any, any>;
                    expect(ack.publishTime.getTime()).toBeLessThanOrEqual(ack.receiveTime.getTime());
                    expect(ack.receiveTime.getTime()).toBeLessThanOrEqual(ack.finishTime.getTime());
                });
                test('Durations positive and align: processDuration < totalDuration', () => {
                    const ack = events.find(e => e.action === 'ack')! as FinishedMessageMetadata<any, any>;
                    expect(ack.processDurationMillis).toBeLessThanOrEqual(ack.totalDurationMillis);
                    expect(ack.processDurationMillis).toBeGreaterThanOrEqual(0);
                });
            });
            test.todo('Types match');
            test.todo('Can send/receive large batch');
            describe('Flow control', () => {
                const testFlowControl = async (topicName: string, n: number, options?: FuQuOptions) => {
                    const fuq = await adapter.createFuQu(topicName, options);
                    let running = 0;
                    let processed = 0;
                    const simultaneouslyRan: number[] = [];
                    await new Promise(async resolve => {
                        await fuq.subscribe(async () => {
                            running++;
                            await new Promise(r => setTimeout(r, 300));
                            simultaneouslyRan.push(running);
                            await new Promise(r => setTimeout(r, 300));
                            running--;
                            processed++;
                            if (processed === n) resolve();
                        });
                        Array.from(new Array(n).keys()).forEach(i => fuq.publish({ i }));
                    });
                    await fuq.close();
                    return simultaneouslyRan;
                };
                test('Runs handlers simultaneously by default', async () => {
                    expect(uniq(await testFlowControl('fuqu-flow1', 3))).toStrictEqual([3]);
                });
                test('Supports maxMessages flow control', async () => {
                    expect(uniq(await testFlowControl('fuqu-flow1', 3, { maxMessages: 1 }))).toStrictEqual([1]);
                });
            });
        });
    });
}
