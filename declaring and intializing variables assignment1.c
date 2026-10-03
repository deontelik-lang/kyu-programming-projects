#include <stdio.h>

int main()
{
    // declare and initialize variables

    char grade = 'A';
    char name[15] = "Brayan";
    int age = 18;
    float marks = 80;
    double pi = 3.0;

    printf("The grade %c\n", grade);
    printf("My name is %s\n", name);
    printf("I am %d years old\n", age);
    printf("I scored %.2f marks\n", marks);
    printf("The value of pi is %.3f\n", pi);

    return 0;
}
