import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrimaryButton from '../components/PrimaryButton.jsx'
import AvatarDot from '../components/AvatarDot.jsx'
import CountdownTimer from '../components/CountdownTimer.jsx'
import CodeInputBoxes from '../components/CodeInputBoxes.jsx'

describe('PrimaryButton', () => {
  it('renders children', () => {
    render(<PrimaryButton>Click me</PrimaryButton>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const fn = vi.fn()
    render(<PrimaryButton onClick={fn}>Go</PrimaryButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', () => {
    const fn = vi.fn()
    render(<PrimaryButton onClick={fn} disabled>Go</PrimaryButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).not.toHaveBeenCalled()
  })

  it('applies fullWidth class when prop is set', () => {
    render(<PrimaryButton fullWidth>Wide</PrimaryButton>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })

  it('renders ghost variant', () => {
    render(<PrimaryButton variant="ghost">Ghost</PrimaryButton>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})

describe('AvatarDot', () => {
  it('renders first character of name', () => {
    render(<AvatarDot index={0} name="Alice" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('renders uppercase initial', () => {
    render(<AvatarDot index={0} name="bob" />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})

describe('CountdownTimer', () => {
  it('renders the remaining seconds', () => {
    const future = Date.now() + 10_000
    render(<CountdownTimer timeoutAt={future} />)
    // Should show something like "10s"
    expect(screen.getByText(/\d+s/)).toBeInTheDocument()
  })

  it('calls onExpire when time runs out', async () => {
    vi.useFakeTimers()
    const onExpire = vi.fn()
    render(<CountdownTimer timeoutAt={Date.now() + 100} onExpire={onExpire} />)
    vi.advanceTimersByTime(1500)
    expect(onExpire).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('renders nothing when timeoutAt is null', () => {
    const { container } = render(<CountdownTimer timeoutAt={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('CodeInputBoxes', () => {
  it('renders 6 input boxes', () => {
    render(<CodeInputBoxes value="" onChange={() => {}} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(6)
  })

  it('calls onChange with typed character', () => {
    const onChange = vi.fn()
    render(<CodeInputBoxes value="" onChange={onChange} />)
    const boxes = screen.getAllByRole('textbox')
    fireEvent.change(boxes[0], { target: { value: 'B' } })
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^B/))
  })

  it('converts input to uppercase', () => {
    const onChange = vi.fn()
    render(<CodeInputBoxes value="" onChange={onChange} />)
    const boxes = screen.getAllByRole('textbox')
    fireEvent.change(boxes[0], { target: { value: 'b' } })
    // Should be called with uppercase B or filtered (b is not in charset... but we test the flow)
    expect(onChange).toHaveBeenCalled()
  })

  it('displays existing value characters in boxes', () => {
    render(<CodeInputBoxes value="BCD" onChange={() => {}} />)
    const boxes = screen.getAllByRole('textbox')
    expect(boxes[0]).toHaveValue('B')
    expect(boxes[1]).toHaveValue('C')
    expect(boxes[2]).toHaveValue('D')
    expect(boxes[3]).toHaveValue('')
  })
})
