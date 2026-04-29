const STORAGE_KEY = 'client_uuid'

export function getClientUuid(): string {
    let uuid = localStorage.getItem(STORAGE_KEY)
    if (!uuid) {
        uuid = crypto.randomUUID()
        localStorage.setItem(STORAGE_KEY, uuid)
    }
    return uuid
}