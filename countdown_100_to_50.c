/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that uses a for loop to print numbers from 100 down to 50.
- Each number is printed on a new line
*/

#include <stdio.h>

int main()
{
    int i;

    for (i = 100; i >= 50; i--)
    {
        printf("%d\n", i);
    }

    return 0;
}
