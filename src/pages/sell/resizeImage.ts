/**
 * 고른 사진 파일을 긴 변 maxSize px 이하로 줄여 JPEG data URL 로 만든다 (원본 IO).
 * 작은 사진은 키우지 않는다. canvas 2d 컨텍스트가 없으면 원본 data URL 을 그대로 돌려준다.
 */
export function resizeImage(file: File, maxSize = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('이미지 파일이 아니에요.'))
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const width = Math.round(image.width * scale)
        const height = Math.round(image.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) return resolve(String(reader.result))
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
