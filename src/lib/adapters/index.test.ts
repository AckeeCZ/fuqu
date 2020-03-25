import { PubSub } from '@google-cloud/pubsub';
import { Event, FuQuOptions, FuQu, FinishedMessageMetadata, IncomingMessageMetadata } from '../fuqu';
import { connect } from 'amqplib';
import { fuQuPubSub, fuQuRabbit, fuQuMemory } from '../../index';

const uniq = <T>(xs: T[]) => Array.from(new Set(xs));

const adapters: {
    name: string;
    createFuQu: <P extends object, A extends Record<string, string> = Record<string, string>>(
        topicName: string,
        options?: FuQuOptions,
    ) => Promise<FuQu<P, A, any>>;
}[] = [
    {
        name: 'Pub/Sub',
        createFuQu: async (topicName: string, options?: FuQuOptions) => {
            process.env.PUBSUB_EMULATOR_HOST = 'localhost:8681';
            process.env.PUBSUB_PROJECT_ID = 'fuqu';
            return fuQuPubSub(new PubSub(), topicName, options);
        },
    },
    {
        name: 'Rabbit MQ',
        createFuQu: async (topicName: string, options?: FuQuOptions) =>
            fuQuRabbit(options?.useMock ? null as any : await connect('amqp://localhost'), topicName, options),
    },
    {
        name: 'Memory',
        createFuQu: async (topicName: string, options?: FuQuOptions) =>
            fuQuMemory(undefined, topicName, options),
    },
];
for (let adapter of adapters) {
    describe(adapter.name, () => {
        test('Creates fuqu instance', async () => {
            const fuqu = await adapter.createFuQu('smoke');
            expect(fuqu.close).toBeInstanceOf(Function);
            expect(fuqu.isAlive).toBeInstanceOf(Function);
            expect(fuqu.publish).toBeInstanceOf(Function);
            expect(fuqu.subscribe).toBeInstanceOf(Function);
            await fuqu.close();
        });
        describe('Basic functionality', () => {
            test('Publishes message and receives it in handler', async () => {
                const msg = { foo: new Date().getTime() };
                const fuq = await adapter.createFuQu<{ foo: number }>('fuqu-ack');
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
                const fuq = await adapter.createFuQu<{ foo: number }>('fuqu-nack');
                const handler = jest.fn();
                await new Promise(async resolve => {
                    handler.mockRejectedValueOnce(new Error()).mockImplementationOnce(resolve);
                    await fuq.subscribe(handler);
                    await fuq.publish(msg);
                });
                await fuq.close();
                expect(handler).toBeCalledTimes(2);
            });
            test('Accepts multiple messages', async () => {
                const fuq = await adapter.createFuQu<{ i: number }>('fuqu-batch');
                let processed = 0;
                const n = 10;
                const received: number[] = [];
                const input = Array.from(new Array(n).keys());
                await new Promise(async resolve => {
                    await fuq.subscribe(async p => {
                        processed++;
                        received.push(p.i);
                        if (processed === n) resolve();
                    });
                    input.forEach(i => fuq.publish({ i }));
                });
                await fuq.close();
                expect(received).toHaveLength(n);
                expect(received.sort()).toStrictEqual(input);
            });
        });
        describe('Health checks', () => {
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
                expect(uniq(await testFlowControl('fuqu-flow2', 3, { maxMessages: 1 }))).toStrictEqual([1]);
            });
        });
        describe('Mocking', () => {
            test('Using mock always creates in-memory instance', async () => {
                const events: Event<any, any>[] = [];
                const fuq = await adapter.createFuQu('fuqu-mock', { useMock: true, eventLogger: e => { events.push(e) } });
                await fuq.close();
                expect(events.length).toBeGreaterThan(0);
                events.forEach(e => expect(e.adapter).toBe('memory'))
            });
        })
    });
}
