import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

export const getServerSideProps = async () => {
    const response = await fetch('http://localhost:3333/pools/count')
    const data = await response.json()

    console.log(data)
}