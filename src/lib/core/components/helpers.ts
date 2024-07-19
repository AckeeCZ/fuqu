import { MessageOptionsLike } from "../../contracts/pubsub"

export const bufferParseJson = (buffer: Buffer) => {
    try {
        return JSON.parse(buffer.toString())
    } catch {
        return {}
    }
}

type IsAny<T> = 0 extends (1 & T) ? true : false

// Check for: Argument of type 'SUBTYPE' is not assignable to parameter of type 'TYPE'. 'TYPE' could be instantiated with an arbitrary type which could be unrelated to 'SUBTYPE'.
export type AssertExtends<A, Parent> = A extends Parent ? A : never
export type OverrideJsonType<MessageOptions extends MessageOptionsLike, CustomType> =
    IsAny<CustomType> extends true
        ? MessageOptions
        : AssertExtends<Omit<MessageOptions, 'json'> & { json: CustomType }, MessageOptions>

export type ReplaceAttributes<T, U> = Omit<T, keyof U> & U
