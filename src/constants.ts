export const ONE_MINUTE_MS = 60 * 1000

export const HTTP_MESSAGES = Object.freeze({
  STATUS_200: Object.freeze({
    status: '200',
    message: 'OK',
  }),
  STATUS_401: Object.freeze({
    status: '401',
    message: 'Unauthorized',
  }),
  STATUS_404: Object.freeze({
    status: '404',
    message: 'Page Not Found',
  }),
  STATUS_405: Object.freeze({
    status: '405',
    message: 'Method Not Allowed',
  }),
  STATUS_429: Object.freeze({
    status: '429',
    message: 'Too Many Requests',
  }),
  STATUS_500: Object.freeze({
    status: '500',
    message: 'Internal Server Error'
  }),
})

export const BASE_HEADERS = {
  'Content-Type': 'application/json',
  //'Content-Security-Policy': "default-src 'self'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}