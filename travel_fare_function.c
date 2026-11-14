/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates a travel fare using a function.
- The fare rate is KSh 50 per kilometer
*/

#include <stdio.h>

/* Function prototype */
float calculateFare(float distance);

int main()
{
    float distance, fare;

    printf("Enter the distance travelled (km): ");
    scanf("%f", &distance);

    fare = calculateFare(distance);

    printf("Total Fare: KSh %.2f\n", fare);

    return 0;
}

/* Function to calculate the fare */
float calculateFare(float distance)
{
    return distance * 50;
}
