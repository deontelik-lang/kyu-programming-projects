/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates the volume and surface area of a cylinder.
- Volume = PI x r x r x h
- Surface Area = 2 x PI x r x r + 2 x PI x r x h
- The user enters the radius and the height
*/

#include <stdio.h>

#define PI 3.14159265358979

int main()
{
    double radius, height, volume, surface_area;

    printf("Enter the radius of the cylinder: ");
    scanf("%lf", &radius);

    printf("Enter the height of the cylinder: ");
    scanf("%lf", &height);

    volume = PI * radius * radius * height;
    surface_area = 2 * PI * radius * radius + 2 * PI * radius * height;

    printf("Volume: %.2f\n", volume);
    printf("Surface Area: %.2f\n", surface_area);

    return 0;
}
