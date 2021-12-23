import { MessageLike, PubSubLike, SubscriptionLike } from "../../contracts/pubsub"

export type FuQuSubscriberOptions = { reconnectAfterMillis: number }
export type MessageHandler<M extends MessageLike> = (message: M) => void | Promise<void>


export class Subscriber {
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
    const {
      reconnectAfterMillis: reconnectAfter,
      ...pubsubSubscriptionOptions
    } = subscriptionOptions
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
