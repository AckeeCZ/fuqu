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

export type SubscriptionOptionsLike = { batching?: { maxMessages?: number } }
export type MessageOptionsLike = { json?: any }

export interface MessageLike {
  ack(): void
  nack(): void
  attributes: Record<string, string>
  data: Buffer
  deliveryAttempt: number
  id: string
  length: number
  orderingKey?: string
  publishTime: Date
}

export type SubscriptionLike = ReturnType<PubSubLike<any, any>['subscription']>
