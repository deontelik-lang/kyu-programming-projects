#include <stdio.h>

// Function prototype
int addition(int x, int y);

int main()
{
    int a, b, result;

    printf("Enter any two numbers: ");
    scanf("%d%d", &a, &b);

    result = addition(a, b);   // Calling function

    printf("Required sum is %d", result);

    return 0;
}

// Called function
int addition(int a, int b)
{
    int z;
    z = a + b;
    return z;
}
