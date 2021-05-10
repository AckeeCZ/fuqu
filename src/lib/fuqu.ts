export type FuQuOptions<P = any, A = any> = {
    eventLogger?: (event: Event<P, A>) => void;
    maxMessages?: number,
    useMock?: boolean,
};

export type MessageData<P, A> = {
    payload: P;
    attributes?: A;
};
export type IncomingMessageMetadata<P, A> = MessageData<P, A> & {
    publishTime: Date;
    receiveTime: Date;
};
export type FinishedMessageMetadata<P, A> = IncomingMessageMetadata<P, A> & {
    finishTime: Date;
    // Duration from publish to finish
    totalDurationMillis: number;
    // Duration from receive to finish
    processDurationMillis: number;
};
export type Event<P, A> = { topicName: string, adapter: string } & BareEvent<P, A>;
export type BareEvent<P, A> = (
    | { action: 'create'; options: any }
    | { action: 'hc'; ok: boolean }
    | { action: 'close' }
    | { action: 'subscribe'; handler: string }
    | (MessageData<P, A> & { action: 'publish' })
    | (IncomingMessageMetadata<P, A> & {
        action: 'receive';
    })
    | (FinishedMessageMetadata<P, A> & {
        action: 'ack';
    })
    | (FinishedMessageMetadata<P, A> & {
        action: 'nack';
        error: any;
    })
);

export type Handler<P, A, M> = (data: P, attributes: A, message: M) => Promise<void> | void;

export interface FuQu<P, A, M, PO> {
    /**
     * Publish a message
     * @param payload Object-like message payload
     * @param attributes Optional message attributes
     */
    publish: (payload: P, attributes?: A, options?: PO) => Promise<void>;
    /**
     * Subscribe a message receiver
     * @param handler Async handler that is given data and original message.
     * When handler is finished, message is automatically ack-ed. Throwing
     * an error inside the handler results in nack-ing the message. The
     * handler is awaited to respond to errors but result value ignored.
     */
    subscribe: (handler: Handler<P, A, M>) => Promise<void>;
    /**
     * Test if connection is alive (check if subscription exists)
     * @param timeoutMs Timeout to wait for the response
     */
    isAlive: (timeoutMillis?: number) => Promise<boolean>;
    /**
     * Close all active connections ()
     */
    close: () => Promise<void>;
}
