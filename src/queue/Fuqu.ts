
import * as pubSub from './GooglePubSub';

export type FuquOptions = pubSub.GooglePubSubOptions | any;

export type FuquRequestData = pubSub.GooglePubSubRequestData | any;

export type FuquCallback<M> = (message: FuquMessage<M>) => void;

export interface FuquOperations<M> {
    in(data: any): any;
    off(callback: FuquCallback<M>): any;
}

export interface FuquMessage<T> {
    id: string;
    data: any;
    ack(): void;
    nack(): void;
    original: T;
}

export interface FuquBaseOptions {
    queue?: {
        maxMessages?: number;
    };
}

export enum FuquType {
    custom = 'custom',
    googlePubSub = 'googlePubSub',
}

export type Message<Type extends FuquType> = Type extends FuquType.googlePubSub
    ? pubSub.PubSubMessage
    : any;

export class Fuqu<Type extends FuquType> implements FuquOperations<Message<Type>> {
    private instance: FuquOperations<Message<Type>>;
    constructor(private type: Type, private options: FuquOptions, private adapter?: string) {
        switch (type) {
            case FuquType.googlePubSub:
                // Hotfix types :((
                this.instance = new pubSub.GooglePubSub(options) as any;
                break;
            case FuquType.custom:
                if (!this.adapter) {
                    throw new Error('Adapter must be set');
                }
                const adapt = require(this.adapter!);
                this.instance = new adapt(options);
                break;
            default:
                throw new Error(`Unsupported type ${type}`);
        }
    }
    public in(data: FuquRequestData): any {
        return this.instance.in(data);
    }
    public off(callback: FuquCallback<Message<Type>>): any {
        return this.instance.off(callback);
    }
}
