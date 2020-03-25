import { FuQuCreator, createFuQu, FuQuAdapter } from '../fuquAdapter';
import { FuQuOptions, Handler } from '../fuqu';

interface FuQuMemoryOptions extends FuQuOptions {}

const sleep = (t: number) => new Promise(resolve => setTimeout(resolve, t))

type Message = { payload: any, attributes: any, publishTime: Date };

export const fuQuMemory: FuQuCreator<FuQuMemoryOptions, Message> = (_: undefined, topicName, options) => {
    let opened = true;
    const messages: Message[] = [];
    let openedMessages = 0;
    const handlers: Handler<any, any, any>[] = [];
    const maxMessages = options?.maxMessages ?? Infinity;
    const consume = () => {
        if (openedMessages < maxMessages) {
            const toPop = Math.min(maxMessages, messages.length) - openedMessages
            for (let i = 0; i < toPop; ++i) {
                openedMessages++;
                const msg = messages.pop()!;
                setImmediate(() => handlers.forEach(h => h(msg.payload, msg.attributes, msg)));
            }
        }
        if (messages.length !== 0) setImmediate(consume)
    }
    return createFuQu(
        {
            name: 'memory',
            isAlive: () => sleep(500).then(() => opened),
            close: async () => { opened = false },
            publishJson: async (payload, attributes) => {
                messages.push({ payload, attributes, publishTime: new Date() });
                setImmediate(consume);
            },
            registerHandler: async handler => {
                handlers.push(handler);
            },
            ack: () => { openedMessages-- },
            nack: msg => { openedMessages--; messages.push(msg); setImmediate(consume); },
            createIncomingMessageMetadata: (message, payload) => ({
                payload,
                publishTime: new Date(message.publishTime.getTime()),
                receiveTime: new Date(),
                attributes: message.attributes as any,
            }),
            createFinishedMessageMetadata: (message, incomingMetadata) => {
                const finished = new Date();
                return {
                    ...incomingMetadata,
                    finishTime: finished,
                    totalDurationMillis: finished.getTime() - incomingMetadata.publishTime.getTime(),
                    processDurationMillis: finished.getTime() - incomingMetadata.receiveTime.getTime(),
                };
            },
        },
        topicName,
        options
    );
};
