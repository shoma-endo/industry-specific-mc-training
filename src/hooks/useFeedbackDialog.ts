"use client"

import { useCallback, useState } from 'react'

type FeedbackVariant = 'success' | 'error'

type FeedbackOptions = {
  title: string
  message?: string
  variant?: FeedbackVariant
  onClose?: () => void
}

export function useFeedbackDialog(initial?: FeedbackOptions) {
  const [state, setState] = useState({
    open: false,
    title: initial?.title ?? '',
    message: initial?.message ?? '',
    variant: initial?.variant ?? 'success',
    onClose: initial?.onClose as (() => void) | undefined,
  })

  const showFeedback = useCallback(
    ({ title, message = '', variant = 'success', onClose }: FeedbackOptions) => {
      setState({
        open: true,
        title,
        message,
        variant,
        onClose,
      })
    },
    []
  )

  const closeFeedback = useCallback(() => {
    setState(prev => {
      prev.onClose?.()
      return {
        open: false,
        title: '',
        message: '',
        variant: prev.variant,
        onClose: undefined,
      }
    })
  }, [])

  return {
    feedback: state,
    showFeedback,
    closeFeedback,
  }
}
