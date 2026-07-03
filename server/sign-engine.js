import CryptoJS from 'crypto-js'
import { sm3 } from 'sm-crypto'

/**
 * MD5 32-bit lowercase
 */
export function md5Encrypt(str) {
  return CryptoJS.MD5(str).toString().toLowerCase()
}

/**
 * SM3 hash using sm-crypto library
 * Returns 64-char hex string
 */
export function sm3Encrypt(str) {
  return sm3(str)
}

/**
 * Generate API signature per 云中鹤 spec section 2.6
 *
 * Rules:
 * 1. Encrypt appSecret with MD5 or SM3 first -> encryptedSecret
 * 2. Concatenate: appKey + plainAppSecret + timestamp + plainAppSecret
 * 3. Encrypt the concatenated string with MD5 or SM3 -> final sign
 *
 * @param {string} appKey
 * @param {string} appSecret - plain text appSecret
 * @param {string} timestamp - format yyyy-MM-dd HH:mm:ss
 * @param {'MD5'|'SM3'} grantType
 * @returns {{ encryptedSecret: string, sign: string }}
 */
export function sign(appKey, appSecret, timestamp, grantType = 'MD5') {
  const encrypt = grantType === 'SM3' ? sm3Encrypt : md5Encrypt

  // Step 1: encrypt the appSecret first for transmission
  const encryptedSecret = encrypt(appSecret)

  // Step 2: concatenate for sign: appKey + plainSecret + timestamp + plainSecret
  const signStr = appKey + appSecret + timestamp + appSecret

  // Step 3: encrypt the sign string
  const signValue = encrypt(signStr)

  return {
    encryptedSecret,
    sign: signValue,
  }
}
