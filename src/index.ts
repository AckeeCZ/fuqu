interface PubSubLike<MessageOptions, SubscriptionOptions> {
  topic: (name: string) => {
    publishMessage: (options: MessageOptions) => Promise<[string]>
  }
  subscription: (
    name: string,
    options?: SubscriptionOptions
  ) => {
    on: (event: string, listener: (...args: any[]) => void) => any
    removeAllListeners: () => any
  }
}
type SubscriptionOptionsLike = { batching: { maxMessages?: number } }

interface MessageLike {
  ack(): void
  nack(): void
}
type ClassType<InstanceType> = { new (...args: any[]): InstanceType }

type MessageHandler<M extends MessageLike> = (message: M) => void
type FuQuSubscriberOptions = { reconnectAfterMillis: number }
export const FuQu = <
  MessageOptions,
  SubscriptionOptions extends SubscriptionOptionsLike,
  Message extends MessageLike
>(
  createClient: () => PubSubLike<MessageOptions, SubscriptionOptions>,
  Message: ClassType<Message>,
  defaultSubscriptionOptions?: SubscriptionOptions & FuQuSubscriberOptions
) => {
  const createPublisher = (topicName: string) => {
    const client = createClient()
    const topic = client.topic(topicName)
    return {
      publish: topic.publishMessage.bind(topic),
    }
  }
  const createSubscriber = (
    subscriptionName: string,
    handler: MessageHandler<Message>,
    additionalSubscriptionOptions?: SubscriptionOptions & FuQuSubscriberOptions
  ) => {
    return new Subscriber(
      createClient,
      subscriptionName,
      handler,
      Object.assign(
        {},
        defaultSubscriptionOptions,
        additionalSubscriptionOptions
      )
    )
  }
  return {
    createPublisher,
    createSubscriber,
  }
}

type SubscriptionLike = ReturnType<PubSubLike<any, any>['subscription']>

class Subscriber {
  private subscription?: SubscriptionLike
  private messageInProcessingCount = 0
  private timeout: NodeJS.Timeout | null = null
  private reconnectTimeoutMillis = 0
  private pubsubSubscriptionOptions: any = {}
  constructor(
    private createPubSubClient: () => PubSubLike<any, any>,
    private subscriptionName: string,
    private handler: MessageHandler<any>,
    subscriptionOptions: FuQuSubscriberOptions
  ) {
    const { reconnectAfterMillis: reconnectAfter, ...pubsubSubscriptionOptions } = subscriptionOptions
    this.reconnectTimeoutMillis = reconnectAfter
    this.pubsubSubscriptionOptions = pubsubSubscriptionOptions
    this.setup()
  }

  private setup() {
    this.subscription = this.createPubSubClient().subscription(
      this.subscriptionName,
      this.pubsubSubscriptionOptions
    )
    this.hookHandler()
  }

  private hookHandler() {
    this.subscription?.on('message', async message => {
      this.messageInProcessingCount++
      await this.handler(message)
      this.messageInProcessingCount--
      if (this.isDry()) {
        this.rescheduleTimer()
      }
    })
  }

  private rescheduleTimer() {
    if (!this.reconnectTimeoutMillis) return
    this.clearTimeout()
    this.timeout = setTimeout(() => {
      this.refresh()
    }, this.reconnectTimeoutMillis)
  }

  private refresh() {
    if (!this.isDry()) return
    this.clear()
    this.setup()
  }

  public clear() {
    this.clearTimeout()
    this.subscription?.removeAllListeners()
    this.subscription = undefined
  }

  private clearTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  private isDry() {
    return this.messageInProcessingCount === 0
  }
}
