
import { PubSub, Subscription, Topic } from '@google-cloud/pubsub';
import { FuquCallback, FuquMessage, FuquOperations } from './Fuqu';

export interface GooglePubSubOptions {
    logger?: any;
    projectId: string;
    keyFilename: string;
    topicName: string;
}

export interface GooglePubSubRequestData {
    data: Buffer;
}

export interface GooglePubSubMessage extends FuquMessage {
    ackId?: string;
    attributes?: object;
    connectionId?: string;
    length?: number;
    publishTime?: Date;
    received?: number;
}

export class GooglePubSub implements FuquOperations {
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
        this.subscription = this.initSubscription();
    }
    public async in(data: GooglePubSubRequestData): Promise<any> {
        this.logger.info(data.data, `Publishing message to the '${this.topicName}' topic`);
        try {
            (await this.topic)
                .publisher()
                .publish(data.data);
            this.logger.info(data.data.toString(), `Message successfully published to the '${this.topicName}' topic`);
        } catch (e) {
            this.logger.error(e, `Message publishing to the '${this.topicName}' topic failed: ${e.message}`);
        }
    }
    public async off(callback: FuquCallback<GooglePubSubMessage>) {
        this.logger.info(`Trying to register subscription '${this.topicName}' callback`);
        (await this.subscription).on(`message`, callback);
        this.logger.info(`Listening on ${this.topicName} ... ready for fuq ...`);
    }
    private async initTopic(): Promise<any> {
        this.logger.info(`Initializing the '${this.topicName}' topic`);
        try {
            await this.googlePubSub.createTopic(this.topicName, {});
            this.logger.info(`Topic '${this.topicName}' successfully created`);
        } catch (e) {
            this.logger.error(e, `Topic '${this.topicName}' was not created: ${e.message}`);
        }
        return (await this.googlePubSub).topic(this.topicName);
    }
    private async initSubscription(): Promise<any> {
        this.logger.info(`Initializing the '${this.topicName}' subscription`);
        try {
            await (await this.topic).createSubscription(this.topicName, {});
            this.logger.info(`Subscription '${this.topicName}' successfully created`);
        } catch (e) {
            this.logger.error(e, `Subscription '${this.topicName}' was not created: ${e.message}`);
        }
        return (await this.googlePubSub).subscription(this.topicName);
    }
}
