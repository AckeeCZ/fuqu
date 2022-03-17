import {
  MessageLike,
  PubSubLike,
  SubscriptionLike,
} from '../../contracts/pubsub'
import { FuQuOptions } from '../fuqu-factory'
import { bufferParseJson } from './helpers'

export type FuQuSubscriberOptions = { reconnectAfterMillis?: number, parseJson?: boolean }
export type MessageHandler<M extends MessageLike> = (
  message: M & { jsonData: any }
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
      const patchedMessage = this.patchMessage(message)
      this.options?.logger?.receivedMessage?.(this.subscriptionName, message)
      this.messageIn()
      this.handler(patchedMessage)
    })
  }

  private patchMessage(message: MessageLike) {
    const originalAck = message.ack.bind(message)
    const originalNack = message.nack.bind(message)
    const jsonPatchedMessage = Object.assign(message, {
      jsonData: this.options.parseJson ? bufferParseJson(message.data) : {}
    })
    return Object.assign(jsonPatchedMessage, {
      ack: () => {
        originalAck()
        this.options?.logger?.ackMessage?.(this.subscriptionName, jsonPatchedMessage)
        this.messageOut()
      },
      nack: () => {
        originalNack()
        this.options?.logger?.nackMessage?.(this.subscriptionName, jsonPatchedMessage)
        this.messageOut()
      },
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
