import { isHybridNative } from './native/runtime.ts'

type CredentialDescriptorJSON = Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }
export type CreationOptionsJSON = Omit<PublicKeyCredentialCreationOptions, 'challenge' | 'user' | 'excludeCredentials'> & {
  challenge: string
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string }
  excludeCredentials?: CredentialDescriptorJSON[]
}
export type RequestOptionsJSON = Omit<PublicKeyCredentialRequestOptions, 'challenge' | 'allowCredentials'> & {
  challenge: string
  allowCredentials?: CredentialDescriptorJSON[]
}

type BrowserPublicKeyCredential = typeof PublicKeyCredential & {
  parseCreationOptionsFromJSON?: (options: CreationOptionsJSON) => PublicKeyCredentialCreationOptions
  parseRequestOptionsFromJSON?: (options: RequestOptionsJSON) => PublicKeyCredentialRequestOptions
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) => c.charCodeAt(0))
}

function encode(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function parseCreationOptions(options: CreationOptionsJSON): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: decode(options.challenge),
    user: { ...options.user, id: decode(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map((item) => ({ ...item, id: decode(item.id) })),
  }
}

export function parseRequestOptions(options: RequestOptionsJSON): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: decode(options.challenge),
    allowCredentials: options.allowCredentials?.map((item) => ({ ...item, id: decode(item.id) })),
  }
}

export function passkeysSupported(): boolean {
  return !isHybridNative() && window.isSecureContext && typeof PublicKeyCredential === 'function' && !!navigator.credentials
}

export function serializePasskey(credential: PublicKeyCredential): Record<string, unknown> {
  const modernCredential = credential as PublicKeyCredential & { toJSON?: () => Record<string, unknown> }
  if (typeof modernCredential.toJSON === 'function') return modernCredential.toJSON()

  const { response } = credential
  const commonResponse = { clientDataJSON: encode(response.clientDataJSON) }
  const attestation = response as AuthenticatorAttestationResponse
  const assertion = response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: encode(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: 'attestationObject' in response
      ? { ...commonResponse, attestationObject: encode(attestation.attestationObject), transports: attestation.getTransports?.() ?? [] }
      : {
          ...commonResponse,
          authenticatorData: encode(assertion.authenticatorData),
          signature: encode(assertion.signature),
          userHandle: assertion.userHandle ? encode(assertion.userHandle) : null,
        },
  }
}

export async function createPasskey(options: CreationOptionsJSON): Promise<Record<string, unknown>> {
  const parser = PublicKeyCredential as BrowserPublicKeyCredential
  const publicKey = parser.parseCreationOptionsFromJSON?.(options) ?? parseCreationOptions(options)
  const credential = await navigator.credentials.create({ publicKey })
  if (!(credential instanceof PublicKeyCredential)) throw new Error('パスキーの登録を確認できませんでした。')
  return serializePasskey(credential)
}

export async function getPasskey(options: RequestOptionsJSON): Promise<Record<string, unknown>> {
  const parser = PublicKeyCredential as BrowserPublicKeyCredential
  const publicKey = parser.parseRequestOptionsFromJSON?.(options) ?? parseRequestOptions(options)
  const credential = await navigator.credentials.get({ publicKey })
  if (!(credential instanceof PublicKeyCredential)) throw new Error('パスキーが選択されませんでした。')
  return serializePasskey(credential)
}

export function passkeyError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') return 'パスキー操作を完了できませんでした。もう一度お試しください。'
    if (error.name === 'InvalidStateError') return 'このパスキーはすでに登録されています。'
    if (error.name === 'SecurityError' || error.name === 'NotSupportedError') return 'このブラウザーではパスキーを利用できません。'
  }
  return error instanceof Error ? error.message : 'パスキー操作に失敗しました。'
}
