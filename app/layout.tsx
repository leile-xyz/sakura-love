import type React from "react"
import "./globals.css"

export const metadata = {
  title: "樱花浪漫文字效果",
  description: "浪漫樱花飘落文字动画效果",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body>{children}</body>
    </html>
  )
}
