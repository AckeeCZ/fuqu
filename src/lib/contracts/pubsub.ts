export interface PubSubLike<MessageOptions, SubscriptionOptions> {
  topic: (name: string) => {
    publishMessage: (options: MessageOptions) => any
  }
  subscription: (
    name: string,
    options?: SubscriptionOptions
  ) => {
    on: (event: string, listener: (...args: any[]) => void) => any
    removeAllListeners: () => any
  }
}

export type SubscriptionOptionsLike = { batching: { maxMessages?: number } }

export interface MessageLike {
  ack(): void
  nack(): void
}

export type SubscriptionLike = ReturnType<PubSubLike<any, any>['subscription']>
