import {
  MessageLike,
  PubSubLike,
  SubscriptionLike,
} from '../../contracts/pubsub'
import { FuQuOptions } from '../fuqu-factory'

export type FuQuSubscriberOptions = { reconnectAfterMillis?: number }
export type MessageHandler<M extends MessageLike> = (
  message: M
) => void | Promise<void>

export class Subscriber {
  private subscription?: SubscriptionLike
  private messageInProcessingCount = 0
  private timeout: NodeJS.Timeout | null = null
  private reconnectTimeoutMillis = 0
  constructor(
    private createPubSubClient: () => PubSubLike<any, any>,
    private subscriptionName: string,
    private handler: MessageHandler<any>,
    private options: FuQuOptions
  ) {
    this.reconnectTimeoutMillis = options.reconnectAfterMillis ?? 0
    this.options?.logger?.initializedSubscriber?.(subscriptionName, options)
    this.setup()
  }

  private setup() {
    this.subscription = this.createPubSubClient().subscription(
      this.subscriptionName,
      this.options
    )
    this.hookHandler()
  }

  private hookHandler() {
    this.subscription?.on('message', async (message: MessageLike) => {
      this.options?.logger?.receivedMessage?.(this.subscriptionName, message)
      const originalAck = message.ack.bind(message)
      const originalNack = message.nack.bind(message)
      this.messageIn()
      const patchedMessage = Object.assign(message, {
        ack: () => {
          originalAck()
          this.options?.logger?.ackMessage?.(this.subscriptionName, message)
          this.messageOut()
        },
        nack: () => {
          originalNack()
          this.options?.logger?.nackMessage?.(this.subscriptionName, message)
          this.messageOut()
        },
      })
      this.handler(patchedMessage)
    })
  }

  private messageIn() {
    this.messageInProcessingCount++
  }

  private messageOut() {
    this.messageInProcessingCount--
    if (this.isDry()) {
      this.rescheduleTimer()
    }
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
    this.options?.logger?.subscriberReconnected?.(this.subscriptionName, this.options)
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
