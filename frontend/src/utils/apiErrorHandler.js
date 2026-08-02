import { ERROR_CODES } from '../constants/errorCodes.js'

export class ApiError extends Error {
  constructor({ code, message, fieldErrors = {}, errorId = null, status = null, rawBody = null }) {
    super(message)
    this.name = 'ApiError'
    this.code = code || ERROR_CODES.BAD_REQUEST
    this.message = message || 'Une erreur est survenue.'
    this.fieldErrors = fieldErrors
    this.errorId = errorId
    this.status = status
    this.rawBody = rawBody
  }
}

function isEnvelope(payload) {
  return payload
    && typeof payload === 'object'
    && Object.prototype.hasOwnProperty.call(payload, 'success')
    && Object.prototype.hasOwnProperty.call(payload, 'code')
    && Object.prototype.hasOwnProperty.call(payload, 'message')
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function normalizeApiError(error, fallbackMessage = 'Une erreur est survenue.') {
  if (error instanceof ApiError) return error
  if (error && typeof error === 'object') {
    const response = error.response ?? null
    const payload = error.payload ?? null
    const status = response?.status ?? error.status ?? null
    const fieldErrors = payload?.field_errors ?? payload?.fieldErrors ?? {}
    const message = payload?.message
      || payload?.detail
      || error.message
      || fallbackMessage
    const code = payload?.code || error.code || ERROR_CODES.BAD_REQUEST
    const errorId = payload?.error_id || payload?.errorId || error.errorId || null
    return new ApiError({ code, message, fieldErrors, errorId, status, rawBody: payload })
  }
  return new ApiError({ code: ERROR_CODES.BAD_REQUEST, message: fallbackMessage })
}

export async function parseApiError(response, fallbackMessage = 'Une erreur est survenue.') {
  const payload = await parseJsonResponse(response)

  if (isEnvelope(payload)) {
    return new ApiError({
      code: payload.code,
      message: payload.message,
      fieldErrors: payload.field_errors ?? payload.fieldErrors ?? {},
      errorId: payload.error_id ?? payload.errorId ?? null,
      status: response.status,
      rawBody: payload,
    })
  }

  if (payload && typeof payload === 'object') {
    const message = payload.detail || payload.message || fallbackMessage
    const fieldErrors = payload.field_errors ?? payload.fieldErrors ?? {}
    const code = payload.code || ERROR_CODES.BAD_REQUEST
    const errorId = payload.error_id ?? payload.errorId ?? null
    return new ApiError({
      code,
      message,
      fieldErrors,
      errorId,
      status: response.status,
      rawBody: payload,
    })
  }

  return new ApiError({
    code: ERROR_CODES.BAD_REQUEST,
    message: fallbackMessage,
    status: response.status,
  })
}

function unwrapSuccessPayload(payload) {
  if (isEnvelope(payload)) return payload.data
  return payload
}

export async function apiRequest(
  input,
  {
    method = 'GET',
    headers,
    body,
    credentials = 'include',
    fallbackMessage = 'Une erreur est survenue.',
    expectJson = true,
  } = {},
) {
  const response = await fetch(input, {
    method,
    credentials,
    headers,
    body,
  })

  if (!response.ok) {
    throw await parseApiError(response, fallbackMessage)
  }

  if (!expectJson || response.status === 204) {
    return null
  }

  const payload = await parseJsonResponse(response)
  return unwrapSuccessPayload(payload)
}

export async function apiRequestJson(input, options = {}) {
  return apiRequest(input, { expectJson: true, ...options })
}

export function getFieldError(error, fieldName) {
  if (!error?.fieldErrors) return ''
  return error.fieldErrors[fieldName] || ''
}
