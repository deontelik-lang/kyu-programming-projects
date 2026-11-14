/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that converts Fahrenheit to Celsius using a function.
- C = (F - 32) x 5 / 9
*/

#include <stdio.h>

/* Function prototype */
float convertToCelsius(float fahrenheit);

int main()
{
    float fahrenheit, celsius;

    printf("Enter the temperature in Fahrenheit: ");
    scanf("%f", &fahrenheit);

    celsius = convertToCelsius(fahrenheit);

    printf("Temperature in Celsius: %.2f\n", celsius);

    return 0;
}

/* Function to convert Fahrenheit to Celsius */
float convertToCelsius(float fahrenheit)
{
    return (fahrenheit - 32) * 5.0 / 9.0;
}
