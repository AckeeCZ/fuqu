
import { Message, PubSub, Subscription, Topic } from '@google-cloud/pubsub';
import { FuquBaseOptions, FuquCallback, FuquOperations } from './Fuqu';

// https://cloud.google.com/nodejs/docs/reference/pubsub/0.23.x/Subscription
const defaultMaxMessages = 100; // By default Subscription objects allow you to process 100 messages at the same time

export interface GooglePubSubOptions extends FuquBaseOptions {
    logger?: any;
    projectId: string;
    keyFilename: string;
    topicName: string;
}

export interface GooglePubSubRequestData {
    data: string | object;
}

export type PubSubMessage = Message;

export class GooglePubSub implements FuquOperations<PubSubMessage> {
    private googlePubSub: PubSub;
    private logger: any;
    private readonly topic: Promise<Topic>;
    private readonly subscription: Promise<Subscription>;
    private readonly topicName: string;
    constructor(private options: GooglePubSubOptions) {
        this.googlePubSub = new PubSub(options);
        this.logger = options.logger || console;
        this.topicName = options.topicName;
        this.topic = this.initTopic();
        this.subscription = this.initSubscription(GooglePubSub.getSubscriptionOptions(options));
    }
    public async in(data: GooglePubSubRequestData): Promise<any> {
        this.logger.info(data.data, `Publishing message to the '${this.topicName}' topic`);
        try {
            typeof data.data === 'string'
                ? (await this.topic)
                    .publish(Buffer.from(JSON.stringify(data.data)))
                : (await this.topic)
                    .publishJSON(data.data);
            this.logger.info(data.data, `Message successfully published to the '${this.topicName}' topic`);
        } catch (e) {
            this.logger.error(e, `Message publishing to the '${this.topicName}' topic failed: ${e.message}`);
        }
    }
    public async off(cb: FuquCallback<PubSubMessage>) {
        this.logger.info(`Trying to register subscription '${this.topicName}' callback`);
        (await this.subscription).on(`message`, (message: PubSubMessage) => {
            cb({
                id: message.id,
                data: JSON.parse(message.data.toString()),
                ack: () => message.ack(),
                nack: () => message.nack(),
                original: message,
            });
        });
        this.logger.info(`Listening on ${this.topicName} ... ready for fuq ...`);
    }
    private async initTopic() {
        this.logger.info(`Initializing the '${this.topicName}' topic`);
        const [topic] = await (await this.googlePubSub).topic(this.topicName).get({ autoCreate: true });
        return topic;
    }
    private async initSubscription(subscriptionOptions = {}) {
        this.logger.info(`Initializing the '${this.topicName}' subscription`);
        const [subscription] = await (await this.topic).subscription(this.topicName, subscriptionOptions).get({ autoCreate: true });
        return subscription;
    }
    private static getSubscriptionOptions(queueOptions: FuquBaseOptions | undefined) {
        if (!queueOptions || !queueOptions.queue) {
            return {};
        }
        return {
            flowControl: {
                maxMessages: queueOptions.queue.maxMessages || defaultMaxMessages,
            },
        };
    }
}
