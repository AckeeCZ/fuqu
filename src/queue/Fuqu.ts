
import * as pubSub from './GooglePubSub';

export interface FuquOperations<D, O> {
    in(data: D): any;
    off(callback: (msg: FuquMessage<D, O>) => void): any;
}

export interface FuquMessage<D, O> {
    id: string;
    data: D;
    ack(): void;
    nack(): void;
    original: O;
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

export type OriginalMessage<Type extends FuquType> = Type extends FuquType.googlePubSub
    ? pubSub.OriginalMessage
    : any;

export type FuquOptions<Type extends FuquType> = Type extends FuquType.googlePubSub
    ? pubSub.GooglePubSubOptions
    : any;

export class Fuqu<T extends FuquType, D extends object, O extends OriginalMessage<any> = OriginalMessage<T>> implements FuquOperations<D, O> {
    private instance: FuquOperations<D, O>;
    constructor(private type: T, private options: FuquOptions<T>, private adapter?: string) {
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
    public in: FuquOperations<D, O>['in'] = data => {
        return this.instance.in(data);
    }
    public off: FuquOperations<D, O>['off'] = cb => {
        return this.instance.off(cb);
    }
}
