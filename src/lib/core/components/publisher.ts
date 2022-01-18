export type FuQuPublisher<MessageOptions> = {
  publish: (options: MessageOptions) => Promise<string>
}
