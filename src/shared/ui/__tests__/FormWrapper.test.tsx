import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, TextInput, Keyboard } from 'react-native';
import { FormWrapper } from '../FormWrapper';

jest.spyOn(Keyboard, 'dismiss');

describe('FormWrapper', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders children correctly', () => {
    const { getByText, getByPlaceholderText } = render(
      <FormWrapper>
        <Text>Test Form Header</Text>
        <TextInput placeholder="Enter text" />
      </FormWrapper>
    );

    expect(getByText('Test Form Header')).toBeTruthy();
    expect(getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('dismisses keyboard when outer area is pressed', () => {
    const { getByTestId } = render(
      <FormWrapper testID="custom-form">
        <Text>Form Content</Text>
      </FormWrapper>
    );

    fireEvent.press(getByTestId('custom-form'));
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  });
});
