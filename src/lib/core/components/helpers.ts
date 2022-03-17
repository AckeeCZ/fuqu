export const bufferParseJson = (buffer: Buffer) => {
    try {
        return JSON.parse(buffer.toString())
    } catch {
        return {}
    }
}