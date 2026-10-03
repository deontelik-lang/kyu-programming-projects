// Variables and Data Types

#include <stdio.h>

int main() {

    // Declare variables
    char grade;      // %c
    char name[15];   // %s
    int age;         // %d
    float mark;      // %f
    double pi;       // %lf

    printf("Enter the grade:\t");
    scanf(" %c", &grade);

    printf("Enter name:\t");
    scanf("%14s", &name);

    printf("Enter your age:\t");
    scanf("%d", &age);

    printf("Enter your marks:\t");
    scanf("%f", &mark);

    printf("Enter the pi:\t");
    scanf("%lf", &pi);

    return 0;
}
