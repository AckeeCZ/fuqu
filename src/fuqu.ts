export type FuQuOptions<P = any, A = any> = {
    eventLogger?: (event: Event<P, A>) => void;
};

export type MessageData<P, A> = {
    payload: P;
    attributes?: A;
};
export type IncomingMessageMetadata<P, A> = MessageData<P, A> & {
    published: Date;
    deliveryAttempt: number;
    received: Date;
};
export type FinishedMessageMetadata<P, A> = IncomingMessageMetadata<P, A> & {
    finished: Date;
    publishToFinish: number;
    receivedToFinish: number;
};

export type Event<P, A> = { topicName: string } & (
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

export type Handler<P, M> = (data: P, message: M) => Promise<void> | void;

export interface FuQu<P, A, M> {
    /**
     * Publish a message
     * @param payload Object-like message payload
     * @param attributes Optional message attributes
     */
    publish: (payload: P, attributes?: A) => Promise<void>;
    /**
     * Subscribe a message receiver
     * @param handler Async handler that is given data and original message.
     * When handler is finished, message is automatically ack-ed. Throwing
     * an error inside the handler results in nack-ing the message. The
     * handler is awaited to respond to errors but result value ignored.
     */
    subscribe: (handler: Handler<P, M>) => Promise<void>;
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
